package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }
func (r *Repository) Save(ctx context.Context, aggregate *domain.Invoice) error {
	_ = ctx
	_ = aggregate
	_ = r.pool
	return apperr.ErrNotImplemented
}
func (r *Repository) Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*domain.Invoice, error) {
	_ = ctx
	_ = restaurantID
	_ = id
	_ = r.pool
	return nil, apperr.ErrNotImplemented
}
