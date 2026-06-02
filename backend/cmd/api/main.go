package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	billingapp "restaurant-management/internal/modules/billing/application"
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
	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/realtime"
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
	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("postgres init failed", slog.Any("error", err))
		return
	}
	defer pool.Close()

	tx := postgres.NewTxManager(pool)
	hub := realtime.NewHub()
	dispatcher := outbox.NewDispatcher(pool, hub, log)
	go hub.Run(ctx)
	go dispatcher.Start(ctx)

	router := gin.New()
	router.Use(httpx.RequestID(), httpx.Logger(log), httpx.Recover(), httpx.CORS())
	router.GET("/health", func(c *gin.Context) { httpx.Respond(c, http.StatusOK, gin.H{"status": "ok"}, nil) })
	router.GET("/ws", hub.ServeGin)

	api := router.Group("/api/v1")
	wireRoutes(api, tx, dispatcher, pool, cfg.JWTSecret)

	server := &http.Server{Addr: cfg.HTTPAddr, Handler: router}
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

func wireRoutes(api *gin.RouterGroup, tx *postgres.TxManager, outboxWriter *outbox.Dispatcher, pool *pgxpool.Pool, secret string) {
	identityRepo := identityrepo.NewRepository(pool)
	identityHandler := identityhttp.NewHandler(identityapp.NewAuthenticate(tx, identityRepo, outboxWriter), identityapp.NewManageUsers(tx, identityRepo, outboxWriter))
	identityHandler.RegisterRoutes(api, secret)

	catalogRepo := catalogrepo.NewRepository(pool)
	catalogHandler := cataloghttp.NewHandler(catalogapp.NewCreateMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewUpdateMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewDeleteMenuItem(tx, catalogRepo, outboxWriter), catalogapp.NewToggleAvailability(tx, catalogRepo, outboxWriter))
	catalogHandler.RegisterRoutes(api, secret)

	diningRepo := diningrepo.NewRepository(pool)
	diningHandler := dininghttp.NewHandler(diningapp.NewJoinSession(tx, diningRepo, outboxWriter), diningapp.NewCloseSession(tx, diningRepo, outboxWriter), diningapp.NewManageTableQR(tx, diningRepo, outboxWriter))
	diningHandler.RegisterRoutes(api, secret)

	orderingRepo := orderingrepo.NewRepository(pool)
	orderingHandler := orderinghttp.NewHandler(orderingapp.NewPlaceOrder(tx, orderingRepo, outboxWriter), orderingapp.NewCancelOrEditItem(tx, orderingRepo, outboxWriter), orderingapp.NewUpdateItemStatus(tx, orderingRepo, outboxWriter), orderingapp.NewReviewCancelRequest(tx, orderingRepo, outboxWriter))
	orderingHandler.RegisterRoutes(api, secret)
	orderingHandler.RegisterKitchenRoutes(api, secret)

	billingRepo := billingrepo.NewRepository(pool)
	billingHandler := billinghttp.NewHandler(billingapp.NewBuildInvoice(tx, billingRepo, outboxWriter), billingapp.NewAdjustInvoice(tx, billingRepo, outboxWriter), billingapp.NewProcessPayment(tx, billingRepo, outboxWriter))
	billingHandler.RegisterRoutes(api, secret)
	billingHandler.RegisterWebhookRoutes(api)
}
