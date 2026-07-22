package logger

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/natefinch/lumberjack.v2"
)

type ctxKey struct{}

func New(env, level, logDir string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level:     parseLevel(level),
		AddSource: true,
	}
	var w io.Writer = os.Stdout
	if strings.EqualFold(env, "production") && logDir != "" {
		w = &lumberjack.Logger{
			Filename:   filepath.Join(logDir, "api.log"),
			MaxSize:    100,
			MaxAge:     7,
			MaxBackups: 14,
			Compress:   true,
		}
	}
	var h slog.Handler
	if strings.EqualFold(env, "production") {
		h = slog.NewJSONHandler(w, opts)
	} else {
		h = slog.NewTextHandler(w, opts)
	}
	l := slog.New(h).With(
		slog.String("service", "restaurant-api"),
		slog.String("env", env),
	)
	slog.SetDefault(l)
	return l
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func WithContext(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok && l != nil {
		return l
	}
	return slog.Default()
}
