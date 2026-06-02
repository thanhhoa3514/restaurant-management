package tenant

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type contextKey struct{}

func WithRestaurantID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}
func RestaurantID(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(contextKey{}).(uuid.UUID)
	return id, ok
}
func MustRestaurantID(ctx context.Context) (uuid.UUID, error) {
	id, ok := RestaurantID(ctx)
	if !ok || id == uuid.Nil {
		return uuid.Nil, fmt.Errorf("restaurant_id missing")
	}
	return id, nil
}
