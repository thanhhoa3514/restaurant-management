package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/migrations"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel, cfg.LogDir)

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Error("open database failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer db.Close()

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		log.Error("set dialect failed", slog.Any("error", err))
		os.Exit(1)
	}

	if err := goose.RunContext(context.Background(), command, db, "."); err != nil {
		log.Error("migration failed", slog.String("command", command), slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("migration complete", slog.String("command", command))
}
