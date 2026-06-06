package application

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/shared/apperr"
)

type fakeTx struct{}

func (fakeTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeRepo struct {
	restaurantID uuid.UUID
	user         *domain.User
	resolveErr   error
	findErr      error
	permissions  []string
	successes    int
	failures     int
}

func (r *fakeRepo) ResolveRestaurantIDByCode(context.Context, string) (uuid.UUID, error) {
	if r.resolveErr != nil {
		return uuid.Nil, r.resolveErr
	}
	return r.restaurantID, nil
}
func (r *fakeRepo) FindByUsername(context.Context, uuid.UUID, string) (*domain.User, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	return r.user, nil
}
func (r *fakeRepo) FindByID(context.Context, uuid.UUID, uuid.UUID) (*domain.User, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	return r.user, nil
}
func (r *fakeRepo) ResolvePermissionCodes(context.Context, uuid.UUID, uuid.UUID) ([]string, error) {
	return r.permissions, nil
}
func (r *fakeRepo) RecordLoginSuccess(context.Context, uuid.UUID, uuid.UUID) error {
	r.successes++
	return nil
}
func (r *fakeRepo) RecordLoginFailure(context.Context, uuid.UUID, uuid.UUID) error {
	r.failures++
	return nil
}

func hashedPassword(t *testing.T, password string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	require.NoError(t, err)
	return string(h)
}

func activeUser(t *testing.T, rid uuid.UUID) *domain.User {
	return &domain.User{
		ID:           uuid.New(),
		RestaurantID: rid,
		Username:     "manager",
		PasswordHash: hashedPassword(t, "secret"),
		FullName:     "Manager",
		Status:       domain.UserStatusActive,
		RoleID:       uuid.New(),
		RoleName:     "manager",
	}
}

func TestAuthenticateHandle(t *testing.T) {
	rid := uuid.New()
	baseReq := AuthenticateRequest{RestaurantCode: "DEMO", Username: "manager", Password: "secret"}

	cases := []struct {
		name          string
		mutate        func(*fakeRepo)
		req           AuthenticateRequest
		wantCode      apperr.Code
		wantSuccesses int
		wantFailures  int
	}{
		{name: "success", wantSuccesses: 1},
		{name: "unknown user", mutate: func(r *fakeRepo) { r.findErr = apperr.New(apperr.CodeNotFound, "missing") }, wantCode: apperr.CodeUnauthorized},
		{name: "wrong password", req: AuthenticateRequest{RestaurantCode: "DEMO", Username: "manager", Password: "wrong"}, wantCode: apperr.CodeUnauthorized, wantFailures: 1},
		{name: "inactive", mutate: func(r *fakeRepo) { r.user.Status = domain.UserStatusInactive }, wantCode: apperr.CodeForbidden},
		{name: "locked status", mutate: func(r *fakeRepo) { r.user.Status = domain.UserStatusLocked }, wantCode: apperr.CodeForbidden},
		{name: "locked until future", mutate: func(r *fakeRepo) { until := time.Now().Add(time.Hour); r.user.LockedUntil = &until }, wantCode: apperr.CodeForbidden},
		{name: "lowercase role uppercased", wantSuccesses: 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := baseReq
			if tc.req != (AuthenticateRequest{}) {
				req = tc.req
			}
			repo := &fakeRepo{
				restaurantID: rid,
				user:         activeUser(t, rid),
				permissions:  []string{"billing.process", "ordering.staff"},
			}
			if tc.mutate != nil {
				tc.mutate(repo)
			}
			svc := NewAuthenticate(fakeTx{}, repo, nil, "test-secret", time.Hour)
			out, err := svc.Handle(context.Background(), req)
			if tc.wantCode != "" {
				require.Error(t, err)
				require.True(t, apperr.Is(err, tc.wantCode), "got %v", err)
				require.Empty(t, out.Token)
			} else {
				require.NoError(t, err)
				require.NotEmpty(t, out.Token)
				require.Equal(t, repo.user.ID, out.UserID)
				require.Equal(t, rid, out.RestaurantID)
				require.Equal(t, "MANAGER", out.Role)
				require.Equal(t, repo.user.FullName, out.Name)
				require.Equal(t, repo.permissions, out.Permissions)
			}
			require.Equal(t, tc.wantSuccesses, repo.successes)
			require.Equal(t, tc.wantFailures, repo.failures)
		})
	}
}

func TestAuthenticateMissingFieldsInvalid(t *testing.T) {
	svc := NewAuthenticate(fakeTx{}, &fakeRepo{}, nil, "test-secret", time.Hour)
	_, err := svc.Handle(context.Background(), AuthenticateRequest{RestaurantCode: "DEMO", Username: "manager"})
	require.True(t, apperr.Is(err, apperr.CodeInvalid))
}
