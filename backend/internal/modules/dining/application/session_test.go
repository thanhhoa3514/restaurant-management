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
	abandoned     bool
	createdQR     *domain.QRCode
	createQRErr   error

	createdTable   *domain.Table
	updatedTable   *domain.Table
	deletedTableID uuid.UUID
	savedPositions []domain.TablePosition
	areas          []domain.Area
	areaCount      int
	areaTableCount int

	devices []*domain.SessionDevice
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
func (r *fakeRepo) ListAreas(context.Context, uuid.UUID) ([]domain.Area, error) {
	return r.areas, nil
}
func (r *fakeRepo) CountAreas(context.Context, uuid.UUID) (int, error) { return r.areaCount, nil }
func (r *fakeRepo) CountTablesInArea(context.Context, uuid.UUID, uuid.UUID) (int, error) {
	return r.areaTableCount, nil
}
func (r *fakeRepo) CreateArea(context.Context, *domain.Area) error         { return nil }
func (r *fakeRepo) UpdateArea(context.Context, *domain.Area) error         { return nil }
func (r *fakeRepo) DeleteArea(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (r *fakeRepo) ListDailySessions(context.Context, uuid.UUID, domain.ListDailySessionsFilter) (domain.ListDailySessionsResponse, error) {
	return domain.ListDailySessionsResponse{}, nil
}
func (r *fakeRepo) GetSessionDetail(context.Context, uuid.UUID, uuid.UUID) (domain.SessionDetailDTO, error) {
	return domain.SessionDetailDTO{}, nil
}
func (r *fakeRepo) FindArea(_ context.Context, _ uuid.UUID, areaID uuid.UUID) (*domain.Area, error) {
	return &domain.Area{ID: areaID, IsActive: true}, nil
}
func (r *fakeRepo) CreateTable(_ context.Context, t *domain.Table) error {
	r.createdTable = t
	return nil
}
func (r *fakeRepo) UpdateTable(_ context.Context, t *domain.Table) error {
	r.updatedTable = t
	return nil
}
func (r *fakeRepo) UpdateTablePositions(_ context.Context, _ uuid.UUID, positions []domain.TablePosition) error {
	r.savedPositions = positions
	return nil
}
func (r *fakeRepo) SoftDeleteTable(_ context.Context, _, tableID uuid.UUID) error {
	r.deletedTableID = tableID
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
func (r *fakeRepo) AbandonPendingSession(_ context.Context, _, sessionID uuid.UUID, actorID *uuid.UUID) error {
	r.abandoned = true
	if r.activeSession != nil {
		r.activeSession.Status = domain.SessionClosed
	}
	for _, device := range r.devices {
		if device.SessionID == sessionID && device.Status == domain.DevicePending {
			device.Status = domain.DeviceRejected
			device.ApprovedBy = actorID
		}
	}
	return nil
}
func (r *fakeRepo) DeactivateActiveQR(context.Context, uuid.UUID, uuid.UUID, *uuid.UUID, string) error {
	r.deactivated = true
	return nil
}
func (r *fakeRepo) FindSessionByID(_ context.Context, _, sessionID uuid.UUID) (*domain.DiningSession, error) {
	if r.activeErr != nil {
		return nil, r.activeErr
	}
	if r.activeSession == nil || r.activeSession.ID != sessionID {
		return nil, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	return r.activeSession, nil
}
func (r *fakeRepo) CreateMergeGroup(_ context.Context, g *domain.MergeGroup) error {
	g.ID = uuid.New()
	return nil
}
func (r *fakeRepo) DeactivateMergeGroup(_ context.Context, _, _ uuid.UUID) error { return nil }
func (r *fakeRepo) FindActiveMergeGroup(_ context.Context, _, _ uuid.UUID) (*domain.MergeGroup, error) {
	return &domain.MergeGroup{ID: uuid.New(), IsActive: true}, nil
}
func (r *fakeRepo) FindSessionsByMergeGroup(_ context.Context, _, _ uuid.UUID) ([]domain.DiningSession, error) {
	return nil, nil
}
func (r *fakeRepo) UpdateSessionMergeGroup(_ context.Context, _ uuid.UUID, _ *uuid.UUID) error {
	return nil
}

func (r *fakeRepo) FindSessionsPendingVerification(_ context.Context, _ uuid.UUID) ([]domain.DiningSession, error) {
	return nil, nil
}
func (r *fakeRepo) VerifySession(_ context.Context, _, _ uuid.UUID, _ *uuid.UUID) error {
	if r.activeErr != nil {
		return r.activeErr
	}
	if r.activeSession == nil {
		return apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	r.activeSession.Status = domain.SessionActive
	return nil
}

func (r *fakeRepo) CreateSessionDevice(_ context.Context, d *domain.SessionDevice) error {
	d.ID = uuid.New()
	r.devices = append(r.devices, d)
	return nil
}
func (r *fakeRepo) FindSessionDevice(_ context.Context, sessionID uuid.UUID, deviceID string) (*domain.SessionDevice, error) {
	for _, d := range r.devices {
		if d.SessionID == sessionID && d.DeviceID == deviceID {
			return d, nil
		}
	}
	return nil, apperr.New(apperr.CodeNotFound, "device not found")
}
func (r *fakeRepo) FindSessionDeviceByID(_ context.Context, _, rowID uuid.UUID) (*domain.SessionDevice, error) {
	for _, d := range r.devices {
		if d.ID == rowID {
			return d, nil
		}
	}
	return nil, apperr.New(apperr.CodeNotFound, "device not found")
}
func (r *fakeRepo) FindDeviceByToken(_ context.Context, token string) (*domain.SessionDevice, error) {
	for _, d := range r.devices {
		if d.AccessToken == token {
			return d, nil
		}
	}
	return nil, apperr.New(apperr.CodeNotFound, "device not found")
}
func (r *fakeRepo) FindPendingDevices(_ context.Context, _ uuid.UUID) ([]domain.PendingDeviceDTO, error) {
	out := make([]domain.PendingDeviceDTO, 0)
	for _, d := range r.devices {
		if d.Status == domain.DevicePending {
			out = append(out, domain.PendingDeviceDTO{DeviceID: d.ID, SessionID: d.SessionID, TableID: d.RestaurantID, GuestName: d.GuestName, IsOwner: d.IsOwner})
		}
	}
	return out, nil
}
func (r *fakeRepo) SetDeviceStatus(_ context.Context, _, rowID uuid.UUID, status domain.DeviceStatus, actorID *uuid.UUID) (*domain.SessionDevice, error) {
	for _, d := range r.devices {
		if d.ID == rowID {
			if d.Status != domain.DevicePending {
				return nil, apperr.New(apperr.CodeConflict, "device is not pending")
			}
			d.Status = status
			d.ApprovedBy = actorID
			return d, nil
		}
	}
	return nil, apperr.New(apperr.CodeNotFound, "device not found")
}
func (r *fakeRepo) FindListTableTest(_ context.Context, _ uuid.UUID) ([]domain.ListTableTest, error) {
	return nil, nil
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
		require.Equal(t, tableID, out.TableID)
		require.Equal(t, string(domain.SessionActive), out.Status)
		require.Equal(t, domain.OpenedViaStaff, repo.created.OpenedVia)
		require.Equal(t, userID, *repo.created.OpenedBy)
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
	newActive := func() *domain.DiningSession {
		return &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionActive}
	}

	t.Run("missing device_id is invalid", func(t *testing.T) {
		svc := NewJoinSession(fakeTx{}, &fakeRepo{activeQR: qr, activeSession: newActive()}, nil)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr"})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("unknown device on active session waits for waiter", func(t *testing.T) {
		repo := &fakeRepo{activeQR: qr, activeSession: newActive()}
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, repo, outbox)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA", GuestName: "Friend", IPHash: "ip1"})
		require.NoError(t, err)
		// A shared link never gets an instant seat: unknown device is PENDING.
		require.Equal(t, "PENDING_VERIFICATION", out.Status)
		require.NotEmpty(t, out.AccessToken)
		require.Len(t, repo.devices, 1)
		require.Equal(t, domain.DevicePending, repo.devices[0].Status)
		require.False(t, repo.devices[0].IsOwner)
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "pending_device", outbox.writes[0].Payload.(map[string]any)["outcome"])
	})

	t.Run("approved device on active session enters immediately", func(t *testing.T) {
		session := newActive()
		repo := &fakeRepo{
			activeQR:      qr,
			activeSession: session,
			devices: []*domain.SessionDevice{{
				ID: uuid.New(), RestaurantID: rid, SessionID: session.ID,
				DeviceID: "devA", Status: domain.DeviceApproved, AccessToken: "tok-A",
			}},
		}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA", ResumeAccessToken: "tok-A"})
		require.NoError(t, err)
		require.Equal(t, string(domain.SessionActive), out.Status)
		require.Equal(t, "tok-A", out.AccessToken)
		require.Len(t, repo.devices, 1) // no new device row
	})

	t.Run("repeated join by same device returns same token, still pending", func(t *testing.T) {
		repo := &fakeRepo{activeQR: qr, activeSession: newActive()}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		first, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA"})
		require.NoError(t, err)
		second, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA", ResumeAccessToken: first.AccessToken})
		require.NoError(t, err)
		require.Equal(t, first.AccessToken, second.AccessToken)
		require.Equal(t, "PENDING_VERIFICATION", second.Status)
		require.Len(t, repo.devices, 1)
	})

	t.Run("known device id without its token cannot recover credential", func(t *testing.T) {
		session := newActive()
		repo := &fakeRepo{
			activeQR:      qr,
			activeSession: session,
			devices: []*domain.SessionDevice{{
				ID: uuid.New(), RestaurantID: rid, SessionID: session.ID,
				DeviceID: "devA", Status: domain.DeviceApproved, AccessToken: "tok-A",
			}},
		}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
		require.Empty(t, out.AccessToken)
	})

	t.Run("rejected device cannot rejoin", func(t *testing.T) {
		session := newActive()
		repo := &fakeRepo{
			activeQR:      qr,
			activeSession: session,
			devices: []*domain.SessionDevice{{
				ID: uuid.New(), RestaurantID: rid, SessionID: session.ID,
				DeviceID: "devA", Status: domain.DeviceRejected, AccessToken: "tok-A",
			}},
		}
		svc := NewJoinSession(fakeTx{}, repo, nil)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA"})
		require.True(t, apperr.Is(err, apperr.CodeForbidden))
	})

	t.Run("no active session creates PENDING owner device", func(t *testing.T) {
		repo := &fakeRepo{
			activeQR:  qr,
			activeErr: apperr.New(apperr.CodeNotFound, "none"),
			table:     &domain.Table{ID: tableID, RestaurantID: rid, Code: "T01", Name: "Bàn 1"},
		}
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, repo, outbox)
		out, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "qr", DeviceID: "devA", GuestName: "Nguyen Van A", IPHash: "ip1"})
		require.NoError(t, err)
		require.Equal(t, "PENDING_VERIFICATION", out.Status)
		require.NotEmpty(t, out.AccessToken)
		require.Equal(t, "T01", out.TableCode)
		require.Equal(t, "Bàn 1", out.TableName)
		require.NotNil(t, repo.created)
		require.Equal(t, domain.SessionPendingVerification, repo.created.Status)
		require.Equal(t, "Nguyen Van A", repo.created.CustomerName)
		require.Len(t, repo.devices, 1)
		require.True(t, repo.devices[0].IsOwner)
		require.Equal(t, "Nguyen Van A", repo.devices[0].GuestName)
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "pending_verification", outbox.writes[0].Payload.(map[string]any)["outcome"])
	})

	t.Run("revoked qr unauthorized but logs outcome", func(t *testing.T) {
		revokedQR := &domain.QRCode{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Token: "old", IsActive: false}
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{activeQR: revokedQR}, outbox)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "old", DeviceID: "devA", IPHash: "ip2"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
		require.Len(t, outbox.writes, 1)
		require.Equal(t, "qr_scan:"+revokedQR.ID.String()+":invalid_or_revoked:ip2", outbox.writes[0].DedupeKey)
	})

	t.Run("unknown qr unauthorized", func(t *testing.T) {
		outbox := &fakeDiningOutbox{}
		svc := NewJoinSession(fakeTx{}, &fakeRepo{resolveErr: apperr.New(apperr.CodeNotFound, "missing")}, outbox)
		_, err := svc.Handle(context.Background(), JoinSessionRequest{QRToken: "bad", DeviceID: "devA"})
		require.True(t, apperr.Is(err, apperr.CodeUnauthorized))
		require.Empty(t, outbox.writes)
	})
}

func TestApproveDevice(t *testing.T) {
	rid := uuid.New()
	tableID := uuid.New()
	actor := uuid.New()

	t.Run("approving owner device activates the session", func(t *testing.T) {
		session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionPendingVerification}
		dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devA", Status: domain.DevicePending, IsOwner: true}
		repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev}}
		outbox := &fakeDiningOutbox{}
		svc := NewApproveDevice(fakeTx{}, repo, outbox, rid)
		out, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: "approve"})
		require.NoError(t, err)
		require.Equal(t, string(domain.DeviceApproved), out.Status)
		require.Equal(t, domain.SessionActive, session.Status)
		require.Equal(t, "dining.session_verified", outbox.writes[0].EventType)
	})

	t.Run("approving a later device does not reset the active session", func(t *testing.T) {
		session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionActive}
		dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devB", Status: domain.DevicePending, IsOwner: false}
		repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev}}
		outbox := &fakeDiningOutbox{}
		svc := NewApproveDevice(fakeTx{}, repo, outbox, rid)
		_, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: "approve"})
		require.NoError(t, err)
		require.Equal(t, domain.SessionActive, session.Status) // never returns to PENDING
		require.Equal(t, "dining.device_approved", outbox.writes[0].EventType)
	})

	t.Run("non-owner cannot activate a pending session", func(t *testing.T) {
		session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionPendingVerification}
		dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devB", Status: domain.DevicePending, IsOwner: false}
		repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev}}
		svc := NewApproveDevice(fakeTx{}, repo, &fakeDiningOutbox{}, rid)
		_, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: "approve"})
		require.True(t, apperr.Is(err, apperr.CodeConflict))
		require.Equal(t, domain.DevicePending, dev.Status)
		require.Equal(t, domain.SessionPendingVerification, session.Status)
	})

	for _, action := range []string{"", "rejcet", "allow"} {
		t.Run("invalid action "+action, func(t *testing.T) {
			session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionPendingVerification}
			dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, Status: domain.DevicePending, IsOwner: true}
			repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev}}
			svc := NewApproveDevice(fakeTx{}, repo, nil, rid)
			_, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: action})
			require.True(t, apperr.Is(err, apperr.CodeInvalid))
			require.Equal(t, domain.DevicePending, dev.Status)
		})
	}

	t.Run("reject marks the device rejected", func(t *testing.T) {
		session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionActive}
		dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devB", Status: domain.DevicePending}
		repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev}}
		svc := NewApproveDevice(fakeTx{}, repo, &fakeDiningOutbox{}, rid)
		out, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: "reject"})
		require.NoError(t, err)
		require.Equal(t, string(domain.DeviceRejected), out.Status)
		require.Equal(t, domain.DeviceRejected, dev.Status)
	})

	t.Run("rejecting owner of a pending table abandons the session", func(t *testing.T) {
		session := &domain.DiningSession{ID: uuid.New(), RestaurantID: rid, TableID: tableID, Status: domain.SessionPendingVerification}
		dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devA", Status: domain.DevicePending, IsOwner: true}
		other := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: session.ID, DeviceID: "devB", Status: domain.DevicePending}
		repo := &fakeRepo{activeSession: session, devices: []*domain.SessionDevice{dev, other}}
		svc := NewApproveDevice(fakeTx{}, repo, &fakeDiningOutbox{}, rid)
		_, err := svc.Handle(context.Background(), ApproveDeviceRequest{DeviceID: dev.ID, ActorID: actor, Action: "reject"})
		require.NoError(t, err)
		require.True(t, repo.abandoned) // table freed, not left as a zombie PENDING session
		require.Equal(t, domain.SessionClosed, session.Status)
		require.Equal(t, domain.DeviceRejected, other.Status)
	})
}

func TestDeviceStatus(t *testing.T) {
	rid := uuid.New()
	dev := &domain.SessionDevice{ID: uuid.New(), RestaurantID: rid, SessionID: uuid.New(), DeviceID: "devA", Status: domain.DevicePending, AccessToken: "tok-A"}
	repo := &fakeRepo{devices: []*domain.SessionDevice{dev}}
	svc := NewDeviceStatus(repo)

	out, err := svc.Handle(context.Background(), DeviceStatusRequest{AccessToken: "tok-A"})
	require.NoError(t, err)
	require.Equal(t, "PENDING", out.Status)

	_, err = svc.Handle(context.Background(), DeviceStatusRequest{AccessToken: ""})
	require.True(t, apperr.Is(err, apperr.CodeInvalid))
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
