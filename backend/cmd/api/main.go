package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	billingapp "restaurant-management/internal/modules/billing/application"
	billingdomain "restaurant-management/internal/modules/billing/domain"
	billinggateway "restaurant-management/internal/modules/billing/infrastructure/gateway"
	billingrepo "restaurant-management/internal/modules/billing/infrastructure/postgres"
	billinghttp "restaurant-management/internal/modules/billing/interfaces/http"
	catalogapp "restaurant-management/internal/modules/catalog/application"
	catalogrepo "restaurant-management/internal/modules/catalog/infrastructure/postgres"
	cataloghttp "restaurant-management/internal/modules/catalog/interfaces/http"
	diningapp "restaurant-management/internal/modules/dining/application"
	diningrepo "restaurant-management/internal/modules/dining/infrastructure/postgres"
	dininghttp "restaurant-management/internal/modules/dining/interfaces/http"
	identityapp "restaurant-management/internal/modules/identity/application"
	identityrepo "restaurant-management/internal/modules/identity/infrastructure/postgres"
	identityhttp "restaurant-management/internal/modules/identity/interfaces/http"
	orderingapp "restaurant-management/internal/modules/ordering/application"
	orderingrepo "restaurant-management/internal/modules/ordering/infrastructure/postgres"
	orderinghttp "restaurant-management/internal/modules/ordering/interfaces/http"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/ratelimit"
	"restaurant-management/internal/platform/realtime"
	"restaurant-management/internal/platform/storage"
	"restaurant-management/internal/platform/swaggerui"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel, cfg.LogDir)
	if err := cfg.Validate(); err != nil {
		log.Error("invalid config", slog.Any("error", err))
		return
	}
	if cfg.SePayDemoAmountVND > 0 {
		log.Warn(
			"SePay demo amount override enabled — a matching transfer will settle the full invoice",
			slog.Int64("sepay_demo_amount_vnd", cfg.SePayDemoAmountVND),
		)
	}
	pool, err := postgres.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("postgres init failed", slog.Any("error", err))
		return
	}
	defer pool.Close()

	// Resolve the single restaurant's UUID from the DB.
	var rid uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM restaurants LIMIT 1`).Scan(&rid); err != nil {
		log.Error("resolve default restaurant failed — run seed first?", slog.Any("error", err))
		return
	}
	cfg.DefaultRestaurantID = rid

	tx := postgres.NewTxManager(pool)
	realtimeSessions := identityrepo.NewSessionRepository(pool, rid)
	realtimeDining := diningrepo.NewRepository(pool, rid)
	hub := realtime.NewHub(
		cfg.AllowedOrigins,
		cfg.JWTSecret,
		rid,
		realtimeSessions,
		realtimeDining,
	)
	dispatcher := outbox.NewDispatcher(pool, hub, log)
	go hub.Run(ctx)
	go dispatcher.Start(ctx)

	var s3Client *storage.Client
	if c, err := storage.NewClient(ctx, storage.S3Config{
		Endpoint:  cfg.S3Endpoint,
		AccessKey: cfg.S3AccessKey,
		SecretKey: cfg.S3SecretKey,
		Bucket:    cfg.S3Bucket,
		UseSSL:    cfg.S3UseSSL,
		PublicURL: cfg.S3PublicURL,
	}, log); err != nil {
		log.Warn("s3 client init failed — upload will be unavailable", slog.Any("error", err))
	} else {
		s3Client = c
	}

	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(httpx.RequestID(), httpx.Logger(log), httpx.Recover(), httpx.CORS(cfg.AllowedOrigins), httpx.MaxBodyBytes(1<<20))

	router.GET("/health", func(c *gin.Context) { httpx.Respond(c, http.StatusOK, gin.H{"status": "ok"}, nil) })

	router.GET("/health/ready", func(c *gin.Context) {
		pingCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(pingCtx); err != nil {
			httpx.Respond(c, http.StatusServiceUnavailable, gin.H{"status": "unavailable"}, nil)
			return
		}
		httpx.Respond(c, http.StatusOK, gin.H{"status": "ready"}, nil)
	})
	router.GET("/ws", hub.ServeGin)
	swaggerui.Register(router)

	api := router.Group("/api/v1")
	wireRoutes(api, tx, dispatcher, pool, cfg, s3Client)

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("http server failed", slog.Any("error", err))
			stop()
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownPeriod)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error("http shutdown failed", slog.Any("error", err))
	}
}

func wireRoutes(api *gin.RouterGroup, tx *postgres.TxManager, outboxWriter *outbox.Dispatcher, pool *pgxpool.Pool, cfg config.Config, s3Client *storage.Client) {
	secret := cfg.JWTSecret
	defaultRID := cfg.DefaultRestaurantID

	identityRepo := identityrepo.NewRepository(pool, defaultRID)
	sessionRepo := identityrepo.NewSessionRepository(pool, defaultRID)
	identityHandler := identityhttp.NewHandler(
		identityapp.NewAuthenticate(tx, identityRepo, sessionRepo, outboxWriter, secret, cfg.JWTTTL, defaultRID),
		identityapp.NewGetSession(identityRepo),
		identityapp.NewManageUsers(tx, identityRepo, outboxWriter),
		identityapp.NewListStaff(identityRepo),
		identityapp.NewListRoles(identityRepo),
		identityapp.NewRefreshSession(sessionRepo, identityRepo, secret, cfg.JWTTTL, defaultRID),
		identityapp.NewLogout(sessionRepo, defaultRID),
		defaultRID,
	)

	catalogRepo := catalogrepo.NewRepository(pool, defaultRID)
	catalogHandler := cataloghttp.NewHandler(catalogapp.NewCreateMenuItem(tx, catalogRepo, outboxWriter, defaultRID), catalogapp.NewUpdateMenuItem(tx, catalogRepo, outboxWriter, defaultRID), catalogapp.NewDeleteMenuItem(tx, catalogRepo, outboxWriter, defaultRID), catalogapp.NewToggleAvailability(tx, catalogRepo, outboxWriter, defaultRID), catalogapp.NewListCategories(catalogRepo, defaultRID), catalogapp.NewListMenuItems(catalogRepo, defaultRID), catalogapp.NewGetMenuItem(catalogRepo, defaultRID), catalogapp.NewListAdminMenuItems(catalogRepo, defaultRID), catalogapp.NewGetAdminMenuItem(catalogRepo, defaultRID), s3Client)

	diningRepo := diningrepo.NewRepository(pool, defaultRID)
	diningHandler := &dininghttp.Handler{
		OpenSession:         diningapp.NewOpenSession(tx, diningRepo, outboxWriter, defaultRID),
		JoinSession:         diningapp.NewJoinSession(tx, diningRepo, outboxWriter),
		CloseSession:        diningapp.NewCloseSession(tx, diningRepo, outboxWriter, defaultRID),
		ManageTableQR:       diningapp.NewManageTableQR(tx, diningRepo, outboxWriter, defaultRID),
		ListTableQRs:        diningapp.NewListTableQRs(diningRepo, defaultRID),
		ListGuestTables:     diningapp.NewListGuestTables(diningRepo, defaultRID),
		MergeSessions:       diningapp.NewMergeSessions(tx, diningRepo, outboxWriter, defaultRID),
		SplitSessions:       diningapp.NewSplitSessions(tx, diningRepo, outboxWriter, defaultRID),
		ListPendingSessions: diningapp.NewListPendingSessions(diningRepo, defaultRID),
		StaffVerifySession:  diningapp.NewStaffVerifySession(tx, diningRepo, outboxWriter, defaultRID),
		SaveTable:           diningapp.NewSaveTable(tx, diningRepo, defaultRID),
		SaveTablePositions:  diningapp.NewSaveTablePositions(tx, diningRepo, defaultRID),
		DeleteTable:         diningapp.NewDeleteTable(tx, diningRepo, defaultRID),
		ListAreas:           diningapp.NewListAreas(diningRepo, defaultRID),
		SaveArea:            diningapp.NewSaveArea(tx, diningRepo, defaultRID),
		DeleteArea:          diningapp.NewDeleteArea(tx, diningRepo, defaultRID),
		ListDailySessions:   diningapp.NewListDailySessions(diningRepo, defaultRID),
		GetSessionDetail:    diningapp.NewGetSessionDetail(diningRepo, defaultRID),
	}

	orderingRepo := orderingrepo.NewRepository(pool, defaultRID)
	orderingHandler := orderinghttp.NewHandler(
		orderingapp.NewGuestPlaceOrder(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewGuestViewOrders(orderingRepo, defaultRID),
		orderingapp.NewGuestEditOrder(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewGuestCancelOrder(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewGuestRequestCancel(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffTables(orderingRepo, defaultRID),
		orderingapp.NewStaffRequestBill(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffReopenSession(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewGuestCallWaiter(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffAckWaiterCall(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffUpdateItemStatus(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewServerReviewOrderItem(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffMarkUnavailable(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffTakeawayOrder(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewStaffAddTakeawayItems(tx, orderingRepo, outboxWriter, defaultRID),
		orderingapp.NewKitchenQueue(orderingRepo, defaultRID),
		orderingapp.NewKitchenListCancelRequests(orderingRepo, defaultRID),
		orderingapp.NewKitchenReviewCancelRequest(tx, orderingRepo, outboxWriter, defaultRID),
	)

	billingRepo := billingrepo.NewRepository(pool, defaultRID)
	gateways := buildGatewayRegistry(cfg)
	billingHandler := billinghttp.NewHandler(
		billingapp.NewBuildInvoice(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewAdjustInvoice(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewProcessPayment(tx, billingRepo, outboxWriter, gateways, cfg.PublicBaseURL, defaultRID),
		billingapp.NewCancelPayment(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewProcessPartialPayment(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewHandleWebhook(tx, billingRepo, outboxWriter, gateways, cfg.MockWebhookSecret, defaultRID),
		billingapp.NewVoidInvoice(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewSplitInvoice(tx, billingRepo, outboxWriter, defaultRID),
		billingapp.NewListSessionInvoices(billingRepo, defaultRID),
		billingapp.NewGuestCheckout(billingRepo, defaultRID),
		cfg.AppEnv,
	)

	orderRateLimiter := ratelimit.NewSlidingWindow(30, 1*time.Minute)
	defer orderRateLimiter.Stop()
	paymentRateLimiter := ratelimit.NewSlidingWindow(120, 1*time.Minute)
	defer paymentRateLimiter.Stop()

	customer := api.Group("/customer")
	diningHandler.RegisterGuestRoutes(customer)
	catalogHandler.RegisterGuestRoutes(customer)

	orders := api.Group("/customer", auth.QRSessionToken(diningRepo), orderRateLimiter.Middleware(ratelimit.GuestSessionKey))
	orderingHandler.RegisterGuestRoutes(orders)

	guestPayments := api.Group("/customer", auth.QRSessionToken(diningRepo), paymentRateLimiter.Middleware(ratelimit.GuestSessionKey))
	billingHandler.RegisterGuestRoutes(guestPayments)

	restaurant := api.Group("/restaurant")
	identityHandler.RegisterRoutes(restaurant, secret, identityRepo, sessionRepo, defaultRID)
	catalogHandler.RegisterStaffRoutes(restaurant, secret, identityRepo, defaultRID)
	diningHandler.RegisterStaffRoutes(restaurant, secret, identityRepo, defaultRID)
	orderingHandler.RegisterStaffRoutes(restaurant, secret, identityRepo, defaultRID)
	orderingHandler.RegisterKitchenRoutes(restaurant, secret, identityRepo, defaultRID)
	billingHandler.RegisterStaffRoutes(restaurant, secret, identityRepo, defaultRID)

	billingHandler.RegisterWebhookRoutes(api)
}

func buildGatewayRegistry(cfg config.Config) *billingdomain.GatewayRegistry {
	registry := billingdomain.NewGatewayRegistry()
	httpClient := &http.Client{Timeout: 10 * time.Second}
	if cfg.AppEnv != "production" {
		registry.Register(billinggateway.NewMock(billinggateway.MockConfig{
			PublicBaseURL: cfg.PublicBaseURL,
			Secret:        cfg.MockWebhookSecret,
		}))
	}
	if cfg.MoMoEndpoint != "" && cfg.MoMoPartnerCode != "" && cfg.MoMoAccessKey != "" && cfg.MoMoSecretKey != "" {
		registry.Register(billinggateway.NewMoMo(billinggateway.MoMoConfig{
			Endpoint:    cfg.MoMoEndpoint,
			PartnerCode: cfg.MoMoPartnerCode,
			AccessKey:   cfg.MoMoAccessKey,
			SecretKey:   cfg.MoMoSecretKey,
			HTTPClient:  httpClient,
		}))
	}
	if cfg.SePayBankCode != "" && cfg.SePayAccountNumber != "" && cfg.SePayWebhookSecret != "" {
		registry.Register(billinggateway.NewSePay(billinggateway.SePayConfig{
			BankCode:      cfg.SePayBankCode,
			AccountNumber: cfg.SePayAccountNumber,
			AccountName:   cfg.SePayAccountName,
			WebhookSecret: cfg.SePayWebhookSecret,
			QRBaseURL:     cfg.SePayQRBaseURL,
			DemoAmountVND: cfg.SePayDemoAmountVND,
		}))
	}
	if cfg.ZaloPayEndpoint != "" && cfg.ZaloPayAppID != "" && cfg.ZaloPayKey1 != "" && cfg.ZaloPayKey2 != "" {
		registry.Register(billinggateway.NewZaloPay(billinggateway.ZaloPayConfig{
			Endpoint:   cfg.ZaloPayEndpoint,
			AppID:      cfg.ZaloPayAppID,
			Key1:       cfg.ZaloPayKey1,
			Key2:       cfg.ZaloPayKey2,
			HTTPClient: httpClient,
		}))
	}
	return registry
}
