package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type fakeTx struct{}

func (fakeTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeRepo struct {
	table          *domain.Table
	activeQR       *domain.QRCode
	createErr      error
	created        *domain.DiningSession
	qrRestaurantID uuid.UUID
	qrTableID      uuid.UUID
	resolveErr     error
	activeSession  *domain.DiningSession
	activeErr      error
}

func (r *fakeRepo) FindTable(context.Context, uuid.UUID, uuid.UUID) (*domain.Table, error) {
	if r.table == nil {
		return nil, apperr.New(apperr.CodeNotFound, "table not found")
	}
	return r.table, nil
}
func (r *fakeRepo) ActiveQRForTable(context.Context, uuid.UUID, uuid.UUID) (*domain.QRCode, error) {
	return r.activeQR, nil
}
func (r *fakeRepo) CreateSession(_ context.Context, s *domain.DiningSession) error {
	if r.createErr != nil {
		return r.createErr
	}
	s.ID = uuid.New()
	r.created = s
	return nil
}
func (r *fakeRepo) ResolveQRToken(context.Context, string) (uuid.UUID, uuid.UUID, error) {
	if r.resolveErr != nil {
		return uuid.Nil, uuid.Nil, r.resolveErr
	}
	return r.qrRestaurantID, r.qrTableID, nil
}
func (r *fakeRepo) FindActiveSessionByTable(context.Context, uuid.UUID, uuid.UUID) (*domain.DiningSession, error) {
	if r.activeErr != nil {
		return nil, r.activeErr
	}
	if r.activeSession == nil {
		return nil, apperr.New(apperr.CodeNotFound, "active session not found")
	}
	return r.activeSession, nil
}

func TestOpenSession(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	userID := uuid.New()
	ctx := tenant.WithRestaurantID(context.Background(), rid)

	t.Run("success", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, activeQR: &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID}}
		svc := NewOpenSession(fakeTx{}, repo, nil)
		out, err := svc.Handle(ctx, OpenSessionRequest{TableID: tableID, OpenedBy: userID})
		require.NoError(t, err)
		require.NotEqual(t, uuid.Nil, out.SessionID)
		require.NotEmpty(t, out.SessionCode)
		require.NotEmpty(t, out.SessionToken)
		require.Equal(t, tableID, out.TableID)
		require.Equal(t, string(domain.SessionActive), out.Status)
		require.Equal(t, domain.OpenedViaStaff, repo.created.OpenedVia)
		require.Equal(t, userID, *repo.created.OpenedBy)
		require.NotEmpty(t, repo.created.SessionToken)
	})

	t.Run("missing table", func(t *testing.T) {
		svc := NewOpenSession(fakeTx{}, &fakeRepo{}, nil)
		_, err := svc.Handle(ctx, OpenSessionRequest{TableID: tableID, OpenedBy: userID})
		require.True(t, apperr.Is(err, apperr.CodeNotFound))
	})

	t.Run("duplicate active session conflict", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, createErr: apperr.New(apperr.CodeConflict, "active session already exists")}
		svc := NewOpenSession(fakeTx{}, repo, nil)
		_, err := svc.Handle(ctx, OpenSessionRequest{TableID: tableID, OpenedBy: userID})
		require.True(t, apperr.Is(err, apperr.CodeConflict))
	})
}

func TestJoinSession(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, SessionToken: "shared-token", Status: domain.SessionActive}

	t.Run("active session returns token", func(t *testing.T) {
		svc := NewJoinSession(fakeTx{}, &fakeRepo{qrRestaurantID: rid, qrTableID: tableID, activeSession: session}, nil)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		require.Equal(t, "shared-token", out.SessionToken)
		require.Equal(t, session.ID, *out.SessionID)
		require.Equal(t, string(domain.SessionActive), out.Status)
	})

	t.Run("repeated join returns same token", func(t *testing.T) {
		repo := &fakeRepo{qrRestaurantID: rid, qrTableID: tableID, activeSession: session}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		first, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		second, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		require.Equal(t, first.SessionToken, second.SessionToken)
		require.Equal(t, *first.SessionID, *second.SessionID)
	})

	t.Run("no active session is not_opened", func(t *testing.T) {
		svc := NewJoinSession(fakeTx{}, &fakeRepo{qrRestaurantID: rid, qrTableID: tableID, activeErr: apperr.New(apperr.CodeNotFound, "none")}, nil)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		require.Equal(t, "not_opened", out.Status)
		require.Empty(t, out.SessionToken)
		require.Nil(t, out.SessionID)
	})

	t.Run("unknown qr unauthorized", func(t *testing.T) {
		svc := NewJoinSession(fakeTx{}, &fakeRepo{resolveErr: apperr.New(apperr.CodeNotFound, "missing")}, nil)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "bad"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
	})
}
