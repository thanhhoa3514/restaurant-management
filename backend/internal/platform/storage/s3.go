package storage

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type S3Config struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	PublicURL string
}

type PresignedResult struct {
	PresignedURL string `json:"presigned_url"`
	PublicURL    string `json:"public_url"`
	ObjectKey    string `json:"object_key"`
}

type Client struct {
	mc        *minio.Client
	bucket    string
	publicURL string
}

func NewClient(ctx context.Context, cfg S3Config, log *slog.Logger) (*Client, error) {
	mc, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("s3 client init: %w", err)
	}

	client := &Client{mc: mc, bucket: cfg.Bucket, publicURL: cfg.PublicURL}

	if err := client.ensureBucket(ctx); err != nil {
		return nil, fmt.Errorf("s3 ensure bucket: %w", err)
	}

	log.Info("s3 client ready", slog.String("bucket", cfg.Bucket), slog.String("endpoint", cfg.Endpoint))
	return client, nil
}

func (c *Client) PresignedPutURL(ctx context.Context, ext string, expiry time.Duration) (*PresignedResult, error) {
	key := fmt.Sprintf("menu/%s%s", uuid.New().String(), ext)

	presigned, err := c.mc.PresignedPutObject(ctx, c.bucket, key, expiry)
	if err != nil {
		return nil, fmt.Errorf("presigned put url: %w", err)
	}

	return &PresignedResult{
		PresignedURL: presigned.String(),
		PublicURL:    fmt.Sprintf("%s/%s", c.publicURL, key),
		ObjectKey:    key,
	}, nil
}
func (c *Client) DeleteObject(ctx context.Context, key string) error {
	return c.mc.RemoveObject(ctx, c.bucket, key, minio.RemoveObjectOptions{})
}

func (c *Client) ensureBucket(ctx context.Context) error {
	exists, err := c.mc.BucketExists(ctx, c.bucket)
	if err != nil {
		return fmt.Errorf("bucket exists check: %w", err)
	}
	if exists {
		return nil
	}

	if err := c.mc.MakeBucket(ctx, c.bucket, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("make bucket: %w", err)
	}

	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [{
			"Effect": "Allow",
			"Principal": "*",
			"Action": "s3:GetObject",
			"Resource": "arn:aws:s3:::%s/*"
		}]
	}`, c.bucket)

	if err := c.mc.SetBucketPolicy(ctx, c.bucket, policy); err != nil {
		return fmt.Errorf("set bucket policy: %w", err)
	}

	return nil
}
