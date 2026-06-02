package guest

import (
	"context"

	"github.com/google/uuid"
)

type contextKey struct{}

type Session struct {
	SessionID uuid.UUID
	TableID   uuid.UUID
}

func WithSession(ctx context.Context, session Session) context.Context {
	return context.WithValue(ctx, contextKey{}, session)
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(contextKey{}).(Session)
	return session, ok
}
