package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type fakeTx struct{}

func (fakeTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeRepo struct {
	table         *domain.Table
	activeQR      *domain.QRCode
	createErr     error
	created       *domain.DiningSession
	resolveErr    error
	activeSession *domain.DiningSession
	activeErr     error
	tablesWithQR  []domain.TableWithQR
	deactivated   bool
	createdQR     *domain.QRCode
	createQRErr   error
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
func (r *fakeRepo) FindQRByToken(context.Context, string) (*domain.QRCode, error) {
	if r.resolveErr != nil {
		return nil, r.resolveErr
	}
	if r.activeQR == nil {
		return nil, apperr.New(apperr.CodeNotFound, "qr token not found")
	}
	return r.activeQR, nil
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
func (r *fakeRepo) ListTablesWithActiveQR(context.Context, uuid.UUID) ([]domain.TableWithQR, error) {
	return r.tablesWithQR, nil
}
func (r *fakeRepo) UpdateSessionCustomerName(_ context.Context, sessionID uuid.UUID, name string) error {
	if r.activeSession != nil && r.activeSession.ID == sessionID {
		r.activeSession.CustomerName = name
	}
	return nil
}
func (r *fakeRepo) CloseSession(context.Context, uuid.UUID, uuid.UUID, *uuid.UUID) (*domain.DiningSession, bool, error) {
	if r.activeErr != nil {
		return nil, false, r.activeErr
	}
	if r.activeSession == nil {
		return nil, false, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	r.activeSession.Status = domain.SessionClosed
	return r.activeSession, true, nil
}
func (r *fakeRepo) DeactivateActiveQR(context.Context, uuid.UUID, uuid.UUID, *uuid.UUID, string) error {
	r.deactivated = true
	return nil
}
func (r *fakeRepo) CreateQR(_ context.Context, qr *domain.QRCode) error {
	if r.createQRErr != nil {
		return r.createQRErr
	}
	qr.ID = uuid.New()
	r.createdQR = qr
	return nil
}

type fakeDiningOutbox struct {
	writes []outbox.WriteEvent
}

func (f *fakeDiningOutbox) Write(_ context.Context, event any) error {
	if e, ok := event.(outbox.WriteEvent); ok {
		f.writes = append(f.writes, e)
	}
	return nil
}

func TestOpenSession(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	userID := uuid.New()
	ctx := context.Background()

	t.Run("success", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, activeQR: &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID}}
		svc := NewOpenSession(fakeTx{}, repo, nil, rid)
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
		svc := NewOpenSession(fakeTx{}, &fakeRepo{}, nil, rid)
		_, err := svc.Handle(ctx, OpenSessionRequest{TableID: tableID, OpenedBy: userID})
		require.True(t, apperr.Is(err, apperr.CodeNotFound))
	})

	t.Run("duplicate active session conflict", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, createErr: apperr.New(apperr.CodeConflict, "active session already exists")}
		svc := NewOpenSession(fakeTx{}, repo, nil, rid)
		_, err := svc.Handle(ctx, OpenSessionRequest{TableID: tableID, OpenedBy: userID})
		require.True(t, apperr.Is(err, apperr.CodeConflict))
	})
}

func TestJoinSession(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	qr := &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Token: "qr", IsActive: true}
	session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, SessionToken: "shared-token", Status: domain.SessionActive}

	t.Run("active session returns token", func(t *testing.T) {
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{activeQR: qr, activeSession: session}, outbox)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", IPHash: "ip1", UserAgent: "ua", TraceID: "trace"})
		require.NoError(t, err)
		require.Equal(t, "shared-token", out.SessionToken)
		require.Equal(t, session.ID, *out.SessionID)
		require.Equal(t, string(domain.SessionActive), out.Status)
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "dining.qr_scanned", outbox.writes[0].EventType)
		require.Equal(t, "qr_code", outbox.writes[0].AggregateType)
		require.Equal(t, qr.ID, outbox.writes[0].AggregateID)
		require.Equal(t, "qr_scan:"+qr.ID.String()+":"+session.ID.String(), outbox.writes[0].DedupeKey)
	})

	t.Run("repeated join returns same token", func(t *testing.T) {
		repo := &fakeRepo{activeQR: qr, activeSession: session}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		first, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		second, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.NoError(t, err)
		require.Equal(t, first.SessionToken, second.SessionToken)
		require.Equal(t, *first.SessionID, *second.SessionID)
	})

	t.Run("no active session is not_opened", func(t *testing.T) {
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{activeQR: qr, activeErr: apperr.New(apperr.CodeNotFound, "none")}, outbox)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", IPHash: "ip1"})
		require.NoError(t, err)
		require.Equal(t, "not_opened", out.Status)
		require.Empty(t, out.SessionToken)
		require.Nil(t, out.SessionID)
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "dining.qr_scanned", outbox.writes[0].EventType)
		require.Equal(t, "qr_scan:"+qr.ID.String()+":not_opened:ip1", outbox.writes[0].DedupeKey)
	})

	t.Run("revoked qr unauthorized but logs outcome", func(t *testing.T) {
		revokedQR := &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Token: "old", IsActive: false}
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{activeQR: revokedQR}, outbox)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "old", IPHash: "ip2"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "qr_scan:"+revokedQR.ID.String()+":invalid_or_revoked:ip2", outbox.writes[0].DedupeKey)
	})

	t.Run("unknown qr unauthorized", func(t *testing.T) {
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{resolveErr: apperr.New(apperr.CodeNotFound, "missing")}, outbox)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "bad"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
		require.Empty(t, outbox.writes)
	})
}

func TestManageTableQR(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	actorID := uuid.New()
	ctx := context.Background()

	t.Run("first generate creates qr without deactivating", func(t *testing.T) {
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}}
		svc := NewManageTableQR(fakeTx{}, repo, nil, rid)
		out, err := svc.Handle(ctx, ManageTableQRRequest{TableID: tableID, ActorID: actorID})
		require.NoError(t, err)
		require.False(t, repo.deactivated)
		require.False(t, out.Rotated)
		require.NotEmpty(t, out.Token)
		require.Equal(t, "active", out.Status)
		require.NotNil(t, repo.createdQR)
		require.Equal(t, actorID, *repo.createdQR.CreatedBy)
	})

	t.Run("idempotent generate returns existing qr", func(t *testing.T) {
		existing := &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Token: "keep-me"}
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, activeQR: existing}
		svc := NewManageTableQR(fakeTx{}, repo, nil, rid)
		out, err := svc.Handle(ctx, ManageTableQRRequest{TableID: tableID, ActorID: actorID})
		require.NoError(t, err)
		require.False(t, repo.deactivated)
		require.Nil(t, repo.createdQR)
		require.False(t, out.Rotated)
		require.Equal(t, "keep-me", out.Token)
	})

	t.Run("rotate deactivates then mints new token", func(t *testing.T) {
		existing := &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Token: "old-token"}
		repo := &fakeRepo{table: &domain.Table{ID: tableID, RestaurantID: rid}, activeQR: existing}
		svc := NewManageTableQR(fakeTx{}, repo, nil, rid)
		out, err := svc.Handle(ctx, ManageTableQRRequest{TableID: tableID, Rotate: true, ActorID: actorID})
		require.NoError(t, err)
		require.True(t, repo.deactivated)
		require.True(t, out.Rotated)
		require.NotEqual(t, "old-token", out.Token)
		require.NotNil(t, repo.createdQR)
	})

	t.Run("missing table not found", func(t *testing.T) {
		svc := NewManageTableQR(fakeTx{}, &fakeRepo{}, nil, rid)
		_, err := svc.Handle(ctx, ManageTableQRRequest{TableID: tableID, ActorID: actorID})
		require.True(t, apperr.Is(err, apperr.CodeNotFound))
	})
}
