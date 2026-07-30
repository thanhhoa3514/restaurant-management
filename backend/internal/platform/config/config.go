package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
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
	PublicBaseURL  string
	LogDir         string

	DefaultRestaurantID uuid.UUID

	MoMoEndpoint    string
	MoMoPartnerCode string
	MoMoAccessKey   string
	MoMoSecretKey   string

	SePayBankCode      string
	SePayAccountNumber string
	SePayAccountName   string
	SePayWebhookSecret string
	SePayQRBaseURL     string
	SePayDemoAmountVND int64

	ZaloPayEndpoint string
	ZaloPayAppID    string
	ZaloPayKey1     string
	ZaloPayKey2     string

	MockWebhookSecret string

	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3UseSSL    bool
	S3PublicURL string
}

func Load() Config {
	appEnv := env("APP_ENV", "development")
	jwtSecret := env("JWT_SECRET", defaultJWTSecret)
	mockSecret := env("MOCK_WEBHOOK_SECRET", "")
	if mockSecret == "" && appEnv != "production" {
		mockSecret = jwtSecret
	}
	return Config{
		HTTPAddr:       env("HTTP_ADDR", ":8080"),
		DatabaseURL:    env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/restaurant?sslmode=disable"),
		JWTSecret:      jwtSecret,
		JWTTTL:         durationEnv("JWT_TTL", 12*time.Hour),
		ShutdownPeriod: durationEnv("SHUTDOWN_SECONDS", 10*time.Second),
		AppEnv:         appEnv,
		LogLevel:       env("LOG_LEVEL", "info"),
		DBMaxConns:     intEnv("DB_MAX_CONNS", 0),
		AllowedOrigins: csvEnv("CORS_ALLOWED_ORIGINS"),
		PublicBaseURL:  strings.TrimRight(env("PUBLIC_BASE_URL", ""), "/"),
		LogDir:         env("LOG_DIR", ""),

		MoMoEndpoint:    strings.TrimRight(env("MOMO_ENDPOINT", ""), "/"),
		MoMoPartnerCode: env("MOMO_PARTNER_CODE", ""),
		MoMoAccessKey:   env("MOMO_ACCESS_KEY", ""),
		MoMoSecretKey:   env("MOMO_SECRET_KEY", ""),

		SePayBankCode:      strings.TrimSpace(firstEnv("", "SEPAY_BANK_CODE", "SEPAY_BANK")),
		SePayAccountNumber: strings.TrimSpace(env("SEPAY_ACCOUNT_NUMBER", "")),
		SePayAccountName:   strings.TrimSpace(firstEnv("", "SEPAY_ACCOUNT_NAME", "SEPAY_ACCOUNT_HOLDER")),
		SePayWebhookSecret: env("SEPAY_WEBHOOK_SECRET", ""),
		SePayQRBaseURL:     strings.TrimRight(env("SEPAY_QR_BASE_URL", "https://vietqr.app/img"), "/"),
		SePayDemoAmountVND: int64Env("SEPAY_DEMO_AMOUNT_VND", 0),

		ZaloPayEndpoint: strings.TrimRight(env("ZALOPAY_ENDPOINT", ""), "/"),
		ZaloPayAppID:    env("ZALOPAY_APP_ID", ""),
		ZaloPayKey1:     env("ZALOPAY_KEY1", ""),
		ZaloPayKey2:     env("ZALOPAY_KEY2", ""),

		MockWebhookSecret: mockSecret,

		S3Endpoint:  env("S3_ENDPOINT", "localhost:9000"),
		S3AccessKey: env("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey: env("S3_SECRET_KEY", "minio-secret"),
		S3Bucket:    env("S3_BUCKET", "restaurant-images"),
		S3UseSSL:    env("S3_USE_SSL", "false") == "true",
		S3PublicURL: strings.TrimRight(env("S3_PUBLIC_URL", "http://localhost:9000/restaurant-images"), "/"),
	}
}

func (c Config) Validate() error {
	if c.AppEnv == "production" && c.JWTSecret == defaultJWTSecret {
		return errors.New("JWT_SECRET must be set in production")
	}
	if c.SePayDemoAmountVND < 0 {
		return errors.New("SEPAY_DEMO_AMOUNT_VND must be zero or positive")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func firstEnv(fallback string, keys ...string) string {
	for _, key := range keys {
		if value := os.Getenv(key); value != "" {
			return value
		}
	}
	return fallback
}

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

func int64Env(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
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
