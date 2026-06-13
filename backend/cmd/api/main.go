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
	"restaurant-management/internal/platform/realtime"
	"restaurant-management/internal/platform/swaggerui"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel)
	if err := cfg.Validate(); err != nil {
		log.Error("invalid config", slog.Any("error", err))
		return
	}
	pool, err := postgres.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("postgres init failed", slog.Any("error", err))
		return
	}
	defer pool.Close()

	tx := postgres.NewTxManager(pool)
	hub := realtime.NewHub(cfg.AllowedOrigins)
	dispatcher := outbox.NewDispatcher(pool, hub, log)
	go hub.Run(ctx)
	go dispatcher.Start(ctx)

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
	wireRoutes(api, tx, dispatcher, pool, cfg)

	// ReadHeaderTimeout defends against Slowloris; IdleTimeout reaps idle
	// keep-alives. ReadTimeout/WriteTimeout are intentionally omitted — they
	// would tear down the long-lived /ws websocket connection.
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

func wireRoutes(api *gin.RouterGroup, tx *postgres.TxManager, outboxWriter *outbox.Dispatcher, pool *pgxpool.Pool, cfg config.Config) {
	secret := cfg.JWTSecret
	identityRepo := identityrepo.NewRepository(pool)
	identityHandler := identityhttp.NewHandler(
		identityapp.NewAuthenticate(tx, identityRepo, outboxWriter, secret, cfg.JWTTTL),
		identityapp.NewGetSession(identityRepo),
		identityapp.NewManageUsers(tx, identityRepo, outboxWriter),
		identityapp.NewListStaff(identityRepo),
		identityapp.NewListRoles(identityRepo),
	)
	identityHandler.RegisterRoutes(api, secret, identityRepo)

	catalogRepo := catalogrepo.NewRepository(pool)
	catalogHandler := cataloghttp.NewHandler(catalogapp.NewCreateMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewUpdateMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewDeleteMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewToggleAvailability(tx, catalogRepo, outboxWriter), catalogapp.NewListCategories(catalogRepo), catalogapp.NewListMenuItems(catalogRepo), catalogapp.NewGetMenuItem(catalogRepo), catalogapp.NewListAdminMenuItems(catalogRepo), catalogapp.NewGetAdminMenuItem(catalogRepo))
	catalogHandler.RegisterRoutes(api, secret, identityRepo)

	diningRepo := diningrepo.NewRepository(pool)
	diningHandler := dininghttp.NewHandler(diningapp.NewOpenSession(tx, diningRepo, outboxWriter), diningapp.NewJoinSession(tx, diningRepo, outboxWriter), diningapp.NewCloseSession(tx, diningRepo, outboxWriter), diningapp.NewManageTableQR(tx, diningRepo, outboxWriter), diningapp.NewListTableQRs(diningRepo))
	diningHandler.RegisterRoutes(api, secret, identityRepo)
	guestGroup := api.Group("/guest", auth.QRSessionToken(diningRepo))
	catalogHandler.RegisterGuestRoutes(guestGroup)

	orderingRepo := orderingrepo.NewRepository(pool)
	orderingHandler := orderinghttp.NewHandler(
		orderingapp.NewPlaceOrder(tx, orderingRepo, outboxWriter),
		orderingapp.NewCancelOrEditItem(tx, orderingRepo, outboxWriter),
		orderingapp.NewUpdateItemStatus(tx, orderingRepo, outboxWriter),
		orderingapp.NewReviewCancelRequest(tx, orderingRepo, outboxWriter),
		orderingapp.NewGuestPlaceOrder(tx, orderingRepo, outboxWriter),
		orderingapp.NewGuestViewOrders(orderingRepo),
		orderingapp.NewGuestEditOrder(tx, orderingRepo, outboxWriter),
		orderingapp.NewGuestCancelOrder(tx, orderingRepo, outboxWriter),
		orderingapp.NewGuestRequestCancel(tx, orderingRepo, outboxWriter),
		orderingapp.NewStaffTables(orderingRepo),
		orderingapp.NewStaffRequestBill(tx, orderingRepo, outboxWriter),
		orderingapp.NewStaffUpdateItemStatus(tx, orderingRepo, outboxWriter),
		orderingapp.NewKitchenQueue(orderingRepo),
	)
	orderingHandler.RegisterRoutes(api, secret, identityRepo)
	orderingHandler.RegisterStaffRoutes(api, secret, identityRepo)
	orderingHandler.RegisterGuestRoutes(guestGroup)
	orderingHandler.RegisterKitchenRoutes(api, secret, identityRepo)

	billingRepo := billingrepo.NewRepository(pool)
	gateways := buildGatewayRegistry(cfg)
	billingHandler := billinghttp.NewHandler(
		billingapp.NewBuildInvoice(tx, billingRepo, outboxWriter),
		billingapp.NewAdjustInvoice(tx, billingRepo, outboxWriter),
		billingapp.NewProcessPayment(tx, billingRepo, outboxWriter, gateways, cfg.PublicBaseURL),
		billingapp.NewHandleWebhook(tx, billingRepo, outboxWriter, gateways, cfg.MockWebhookSecret),
		cfg.AppEnv,
	)
	billingHandler.RegisterRoutes(api, secret, identityRepo)
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
