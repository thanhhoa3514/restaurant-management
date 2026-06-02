// Command migrate applies database schema migrations using goose.
//
// Run separately from the API server (not on boot): goose takes no
// cross-instance lock, so auto-running on startup would race when more than
// one API instance boots. Decoupling schema changes from app boot avoids that.
//
// Usage:
//
//	migrate            # apply all pending migrations (up)
//	migrate up         # apply all pending migrations
//	migrate down       # roll back the last migration
//	migrate status     # print migration status
//	migrate version    # print current DB version
package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
	"github.com/pressly/goose/v3"

	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/migrations"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel)

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
