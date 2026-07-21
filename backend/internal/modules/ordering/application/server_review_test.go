package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

// stubReviewRepo satisfies StaffReadRepository via the embedded interface
// (nil); only the two methods under test are implemented. Any other call
// would panic, which is fine — the use-case never makes them.
type stubReviewRepo struct {
	StaffReadRepository
	confirmErr    error
	rejectReason  string
	rejectedItem  uuid.UUID
	confirmedItem uuid.UUID
}

func (s *stubReviewRepo) ConfirmOrderItem(_ context.Context, _ uuid.UUID, itemID uuid.UUID, _ *uuid.UUID, _ string) (UpdateItemStatusResponse, error) {
	if s.confirmErr != nil {
		return UpdateItemStatusResponse{}, s.confirmErr
	}
	s.confirmedItem = itemID
	return UpdateItemStatusResponse{ID: itemID, Status: "PENDING"}, nil
}

func (s *stubReviewRepo) RejectOrderItem(_ context.Context, _ uuid.UUID, itemID uuid.UUID, reason string, _ *uuid.UUID, _ string) (UpdateItemStatusResponse, error) {
	s.rejectReason = reason
	s.rejectedItem = itemID
	return UpdateItemStatusResponse{ID: itemID, Status: "CANCELLED"}, nil
}

type captureOutbox struct{ lastType string }

func (c *captureOutbox) Write(_ context.Context, event any) error {
	if e, ok := event.(outbox.WriteEvent); ok {
		c.lastType = e.EventType
	}
	return nil
}

func TestServerReviewConfirmEmitsEvent(t *testing.T) {
	repo := &stubReviewRepo{}
	ob := &captureOutbox{}
	uc := NewServerReviewOrderItem(fakeTx{}, repo, ob, uuid.New())

	itemID := uuid.New()
	out, err := uc.Confirm(context.Background(), itemID, nil, "server")
	require.NoError(t, err)
	require.Equal(t, "PENDING", out.Status)
	require.Equal(t, itemID, repo.confirmedItem)
	require.Equal(t, "ordering.item_confirmed", ob.lastType)
}

func TestServerReviewRejectTrimsReasonAndEmits(t *testing.T) {
	repo := &stubReviewRepo{}
	ob := &captureOutbox{}
	uc := NewServerReviewOrderItem(fakeTx{}, repo, ob, uuid.New())

	itemID := uuid.New()
	out, err := uc.Reject(context.Background(), itemID, "  hết nguyên liệu  ", nil, "server")
	require.NoError(t, err)
	require.Equal(t, "CANCELLED", out.Status)
	require.Equal(t, "hết nguyên liệu", repo.rejectReason) // trimmed
	require.Equal(t, "ordering.item_rejected", ob.lastType)
}

func TestServerReviewConfirmPropagatesConflict(t *testing.T) {
	repo := &stubReviewRepo{confirmErr: apperr.New(apperr.CodeConflict, "order item is not awaiting confirmation")}
	ob := &captureOutbox{}
	uc := NewServerReviewOrderItem(fakeTx{}, repo, ob, uuid.New())

	_, err := uc.Confirm(context.Background(), uuid.New(), nil, "server")
	require.Error(t, err)
	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Empty(t, ob.lastType) // no event on failure
}
