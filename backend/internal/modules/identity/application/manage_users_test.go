package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/shared/apperr"
)

func strPtr(s string) *string { return &s }

func TestManageUsersValidation(t *testing.T) {
	s := NewManageUsers(fakeTx{}, &fakeRepo{}, nil)
	ctx := context.Background()
	rid := uuid.New()
	actor := uuid.New()

	t.Run("unknown action rejected", func(t *testing.T) {
		_, err := s.Handle(ctx, ManageUsersRequest{Action: "nuke", RestaurantID: rid})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("create requires valid username", func(t *testing.T) {
		_, err := s.Handle(ctx, ManageUsersRequest{
			Action: "create", Username: "x", FullName: strPtr("X"),
			Role: strPtr("server"), Password: "password1", RestaurantID: rid,
		})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("create enforces password length", func(t *testing.T) {
		_, err := s.Handle(ctx, ManageUsersRequest{
			Action: "create", Username: "newstaff", FullName: strPtr("New Staff"),
			Role: strPtr("server"), Password: "short", RestaurantID: rid,
		})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("create succeeds", func(t *testing.T) {
		out, err := s.Handle(ctx, ManageUsersRequest{
			Action: "create", Username: "newstaff", FullName: strPtr("New Staff"),
			Role: strPtr("server"), Password: "password1", RestaurantID: rid, ActorID: actor,
		})
		require.NoError(t, err)
		require.Equal(t, "create", out.Action)
		require.NotEqual(t, uuid.Nil, out.ID)
	})

	t.Run("cannot deactivate yourself", func(t *testing.T) {
		_, err := s.Handle(ctx, ManageUsersRequest{
			Action: "set_status", UserID: actor, Status: "INACTIVE",
			RestaurantID: rid, ActorID: actor,
		})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("cannot change own role", func(t *testing.T) {
		_, err := s.Handle(ctx, ManageUsersRequest{
			Action: "update", UserID: actor, Role: strPtr("server"),
			RestaurantID: rid, ActorID: actor,
		})
		require.True(t, apperr.Is(err, apperr.CodeInvalid))
	})

	t.Run("set_status valid", func(t *testing.T) {
		out, err := s.Handle(ctx, ManageUsersRequest{
			Action: "set_status", UserID: uuid.New(), Status: "inactive",
			RestaurantID: rid, ActorID: actor,
		})
		require.NoError(t, err)
		require.Equal(t, "set_status", out.Action)
	})
}
