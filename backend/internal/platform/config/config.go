package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

const defaultJWTSecret = "dev-change-me"

type Config struct {
	HTTPAddr       string
	DatabaseURL    string
	JWTSecret      string
	JWTTTL         time.Duration
	ShutdownPeriod time.Duration
	AppEnv         string
	LogLevel       string
	DBMaxConns     int
	AllowedOrigins []string
}

func Load() Config {
	return Config{
		HTTPAddr:       env("HTTP_ADDR", ":8080"),
		DatabaseURL:    env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/restaurant?sslmode=disable"),
		JWTSecret:      env("JWT_SECRET", defaultJWTSecret),
		JWTTTL:         durationEnv("JWT_TTL", 12*time.Hour),
		ShutdownPeriod: durationEnv("SHUTDOWN_SECONDS", 10*time.Second),
		AppEnv:         env("APP_ENV", "development"),
		LogLevel:       env("LOG_LEVEL", "info"),
		DBMaxConns:     intEnv("DB_MAX_CONNS", 0),
		AllowedOrigins: csvEnv("CORS_ALLOWED_ORIGINS"),
	}
}

// Validate rejects unsafe production configuration.
func (c Config) Validate() error {
	if c.AppEnv == "production" && c.JWTSecret == defaultJWTSecret {
		return errors.New("JWT_SECRET must be set in production")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// csvEnv parses a comma-separated env var into a trimmed, non-empty slice.
// Empty/unset returns nil — callers treat nil as "allow all" (dev default).
func csvEnv(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
func intEnv(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
func durationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	if d, err := time.ParseDuration(v); err == nil {
		return d
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return time.Duration(n) * time.Second
}
