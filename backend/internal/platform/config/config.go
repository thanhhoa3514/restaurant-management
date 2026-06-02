package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

const defaultJWTSecret = "dev-change-me"

type Config struct {
	HTTPAddr       string
	DatabaseURL    string
	JWTSecret      string
	ShutdownPeriod time.Duration
	AppEnv         string
	LogLevel       string
}

func Load() Config {
	return Config{
		HTTPAddr:       env("HTTP_ADDR", ":8080"),
		DatabaseURL:    env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/restaurant?sslmode=disable"),
		JWTSecret:      env("JWT_SECRET", defaultJWTSecret),
		ShutdownPeriod: durationEnv("SHUTDOWN_SECONDS", 10*time.Second),
		AppEnv:         env("APP_ENV", "development"),
		LogLevel:       env("LOG_LEVEL", "info"),
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
func durationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return time.Duration(n) * time.Second
}
