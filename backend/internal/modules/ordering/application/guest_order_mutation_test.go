package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/shared/apperr"
)

type fakeOrderEditRepo struct {
	session *domain.SessionForOrder
	order   *domain.OrderForEdit
	lines   []domain.OrderLineForEdit
	options map[uuid.UUID][]domain.OrderLineOptionForEdit

	items    map[uuid.UUID]*domain.MenuItemForOrder
	variants map[uuid.UUID]*domain.VariantForOrder
	groups   map[uuid.UUID][]domain.OptionGroupRule
	opts     map[uuid.UUID]*domain.OptionForOrder

	updated       []domain.OrderLineCreate
	cancelled     []uuid.UUID
	finishVersion int
	finishStatus  string
	view          domain.OrderView
	cancelLine    *domain.OrderLineForEdit
	cancelExists  bool
	createdCancel *domain.CancelRequestCreate
}

func (r *fakeOrderEditRepo) LockSessionForOrder(context.Context, uuid.UUID, uuid.UUID) (*domain.SessionForOrder, error) {
	if r.session == nil {
		return nil, apperr.New(apperr.CodeNotFound, "session not found")
	}
	return r.session, nil
}

func (r *fakeOrderEditRepo) LockOrderForGuest(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) (*domain.OrderForEdit, error) {
	if r.order == nil {
		return nil, apperr.New(apperr.CodeNotFound, "order not found")
	}
	return r.order, nil
}

func (r *fakeOrderEditRepo) LoadOrderLinesForEdit(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) ([]domain.OrderLineForEdit, error) {
	return r.lines, nil
}

func (r *fakeOrderEditRepo) LoadOrderLineOptionsForEdit(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID][]domain.OrderLineOptionForEdit, error) {
	return r.options, nil
}

func (r *fakeOrderEditRepo) FindMenuItemForOrder(_ context.Context, _ uuid.UUID, id uuid.UUID) (*domain.MenuItemForOrder, error) {
	item := r.items[id]
	if item == nil {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	return item, nil
}

func (r *fakeOrderEditRepo) FindVariantForOrder(_ context.Context, _ uuid.UUID, _ uuid.UUID, id uuid.UUID) (*domain.VariantForOrder, error) {
	variant := r.variants[id]
	if variant == nil {
		return nil, apperr.New(apperr.CodeNotFound, "variant not found")
	}
	return variant, nil
}

func (r *fakeOrderEditRepo) ListOptionGroupRules(_ context.Context, _ uuid.UUID, itemID uuid.UUID) ([]domain.OptionGroupRule, error) {
	return r.groups[itemID], nil
}

func (r *fakeOrderEditRepo) ListOptionsForOrder(_ context.Context, _ uuid.UUID, _ uuid.UUID, ids []uuid.UUID) ([]domain.OptionForOrder, error) {
	out := []domain.OptionForOrder{}
	for _, id := range ids {
		if opt := r.opts[id]; opt != nil {
			out = append(out, *opt)
		}
	}
	return out, nil
}

func (r *fakeOrderEditRepo) UpdateOrderLine(_ context.Context, _ uuid.UUID, line domain.OrderLineCreate) error {
	r.updated = append(r.updated, line)
	for i := range r.view.Orders {
		for j := range r.view.Orders[i].Items {
			if r.view.Orders[i].Items[j].ID == line.ID {
				item := &r.view.Orders[i].Items[j]
				item.Quantity = line.Quantity
				item.UnitPriceVND = line.UnitPriceVND
				item.OptionsTotalVND = line.OptionsTotalVND
				item.SubtotalVND = line.SubtotalVND
				item.TotalAmountVND = line.TotalAmountVND
				item.Note = line.Note
			}
		}
	}
	return nil
}

func (r *fakeOrderEditRepo) CancelOrderLines(_ context.Context, _ uuid.UUID, _ uuid.UUID, lineIDs []uuid.UUID, _ string) error {
	r.cancelled = append(r.cancelled, lineIDs...)
	for i := range r.view.Orders {
		for j := range r.view.Orders[i].Items {
			for _, id := range lineIDs {
				if r.view.Orders[i].Items[j].ID == id {
					r.view.Orders[i].Items[j].Status = "CANCELLED"
				}
			}
		}
	}
	return nil
}

func (r *fakeOrderEditRepo) FinishOrderMutation(context.Context, uuid.UUID, uuid.UUID, bool, string) (int, string, error) {
	if r.finishVersion == 0 {
		r.finishVersion = r.order.Version + 1
	}
	if r.finishStatus == "" {
		r.finishStatus = r.order.Status
	}
	return r.finishVersion, r.finishStatus, nil
}

func (r *fakeOrderEditRepo) SessionTotal(context.Context, uuid.UUID, uuid.UUID) (int64, error) {
	return r.view.SessionTotalVND, nil
}

func (r *fakeOrderEditRepo) ViewSessionOrders(context.Context, uuid.UUID, uuid.UUID) (domain.OrderView, error) {
	for i := range r.view.Orders {
		if r.view.Orders[i].ID == r.order.ID {
			r.view.Orders[i].Version = r.finishVersion
			r.view.Orders[i].Status = r.finishStatus
		}
	}
	return r.view, nil
}

func (r *fakeOrderEditRepo) LockOrderLineForCancelRequest(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) (*domain.OrderLineForEdit, error) {
	if r.cancelLine == nil {
		return nil, apperr.New(apperr.CodeNotFound, "order item not found")
	}
	return r.cancelLine, nil
}

func (r *fakeOrderEditRepo) OpenCancelRequestExists(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return r.cancelExists, nil
}

func (r *fakeOrderEditRepo) CreateCancelRequest(_ context.Context, _ uuid.UUID, req *domain.CancelRequestCreate) error {
	req.ID = uuid.New()
	req.Status = "PENDING"
	cp := *req
	r.createdCancel = &cp
	return nil
}

func newEditRepo() (*fakeOrderEditRepo, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) {
	rid := uuid.New()
	sid := uuid.New()
	orderID := uuid.New()
	lineA := uuid.New()
	lineB := uuid.New()
	itemID := uuid.New()
	repo := &fakeOrderEditRepo{
		session: &domain.SessionForOrder{ID: sid, RestaurantID: rid, TableID: uuid.New(), Status: "ACTIVE"},
		order:   &domain.OrderForEdit{ID: orderID, OrderNumber: "ORD-1", OrderType: "INITIAL", Status: "SUBMITTED", Version: 1},
		lines: []domain.OrderLineForEdit{
			{ID: lineA, OrderID: orderID, MenuItemID: itemID, Status: "PENDING", Quantity: 2},
			{ID: lineB, OrderID: orderID, MenuItemID: itemID, Status: "PENDING", Quantity: 1},
		},
		options:       map[uuid.UUID][]domain.OrderLineOptionForEdit{},
		items:         map[uuid.UUID]*domain.MenuItemForOrder{itemID: {ID: itemID, Code: "M1", Name: "Soup", BasePriceVND: 100, Station: "HOT", Orderable: true}},
		variants:      map[uuid.UUID]*domain.VariantForOrder{},
		groups:        map[uuid.UUID][]domain.OptionGroupRule{},
		opts:          map[uuid.UUID]*domain.OptionForOrder{},
		finishVersion: 2,
		finishStatus:  "SUBMITTED",
		view: domain.OrderView{SessionTotalVND: 100, Orders: []domain.OrderRead{{ID: orderID, OrderNumber: "ORD-1", OrderType: "INITIAL", Status: "SUBMITTED", Version: 1, Items: []domain.OrderItemRead{
			{ID: lineA, OrderID: orderID, MenuItemID: itemID, NameSnapshot: "Soup", Quantity: 2, UnitPriceVND: 100, SubtotalVND: 200, TotalAmountVND: 200, Status: "PENDING", Station: "HOT"},
			{ID: lineB, OrderID: orderID, MenuItemID: itemID, NameSnapshot: "Soup", Quantity: 1, UnitPriceVND: 100, SubtotalVND: 100, TotalAmountVND: 100, Status: "PENDING", Station: "HOT"},
		}}}},
	}
	return repo, rid, sid, orderID, lineA, lineB
}

func TestGuestEditOrderUpdatesPendingAndCancelsOmittedLines(t *testing.T) {
	repo, rid, sid, orderID, lineA, lineB := newEditRepo()
	outbox := &fakeOutbox{}
	out, err := NewGuestEditOrder(fakeTx{}, repo, outbox, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 1,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 1, Note: "less"}},
	})

	require.NoError(t, err)
	require.Len(t, repo.updated, 1)
	require.Equal(t, lineA, repo.updated[0].ID)
	require.EqualValues(t, 100, repo.updated[0].TotalAmountVND)
	require.Equal(t, []uuid.UUID{lineB}, repo.cancelled)
	require.Equal(t, 2, out.Version)
	require.Equal(t, "SUBMITTED", out.Status)
	require.Equal(t, 1, outbox.writes)
}

func TestGuestEditOrderStaleVersionRejected(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	_, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 99,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 1}},
	})

	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Empty(t, repo.updated)
	require.Empty(t, repo.cancelled)
}

func TestGuestEditOrderRequiresVersionAndItems(t *testing.T) {
	repo, rid, sid, orderID, _, _ := newEditRepo()
	_, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
	})
	require.True(t, apperr.Is(err, apperr.CodeInvalid))

	_, err = NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{OrderID: orderID, Version: 1})
	require.True(t, apperr.Is(err, apperr.CodeInvalid))
}

func TestGuestEditOrderLockedLineReturnsLineConflict(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	repo.lines[0].Status = "PREPARING"
	_, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 1,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 1}},
	})

	var lineErr *LineOperationError
	require.ErrorAs(t, err, &lineErr)
	require.Equal(t, apperr.CodeConflict, lineErr.Code)
	require.Equal(t, "line_locked", lineErr.LineErrors[0].Reason)
	require.Equal(t, 0, lineErr.LineErrors[0].Index)
	require.Empty(t, repo.updated)
}

func TestGuestEditOrderIncreasingUnavailableLineRejected(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	itemID := repo.lines[0].MenuItemID
	repo.items[itemID].Orderable = false
	_, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 1,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 3}},
	})

	var lineErr *LineOperationError
	require.ErrorAs(t, err, &lineErr)
	require.Equal(t, apperr.CodeInvalid, lineErr.Code)
	require.Equal(t, "unavailable", lineErr.LineErrors[0].Reason)
	require.Empty(t, repo.updated)
}

func TestGuestEditOrderDecreaseUnavailableLineWithExistingOptionAllowed(t *testing.T) {
	repo, rid, sid, orderID, lineA, lineB := newEditRepo()
	itemID := repo.lines[0].MenuItemID
	groupID := uuid.New()
	optID := uuid.New()
	repo.items[itemID].Orderable = false
	repo.groups[itemID] = []domain.OptionGroupRule{{ID: groupID, Name: "Sauce", SelectionType: "SINGLE", MaxSelections: ptrInt(1)}}
	repo.options[lineA] = []domain.OrderLineOptionForEdit{{
		OrderItemID:             lineA,
		OptionID:                optID,
		OptionGroupID:           groupID,
        OptionNameSnapshot:      "Old sauce",
        OptionGroupNameSnapshot: "Sauce",
        PriceDeltaSnapshotVND:   10,
        Quantity:                1,
        }}

        out, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 1,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 1, Options: []GuestOrderOptionRequest{{OptionID: optID, Quantity: 1}}}},
	})

	require.NoError(t, err)
	require.EqualValues(t, 110, repo.updated[0].TotalAmountVND)
	require.Equal(t, "Old sauce", repo.updated[0].Options[0].OptionNameSnapshot)
	require.Equal(t, []uuid.UUID{lineB}, repo.cancelled)
	require.Equal(t, 2, out.Version)
}

func TestGuestCancelOrderCancelsOnlyWhenAllLinesPending(t *testing.T) {
	repo, rid, sid, orderID, lineA, lineB := newEditRepo()
	repo.finishStatus = "CANCELLED"
	outbox := &fakeOutbox{}
	out, err := NewGuestCancelOrder(fakeTx{}, repo, outbox, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestCancelOrderRequest{OrderID: orderID})

	require.NoError(t, err)
	require.ElementsMatch(t, []uuid.UUID{lineA, lineB}, repo.cancelled)
	require.Equal(t, "CANCELLED", out.Status)
	require.Equal(t, 1, outbox.writes)

	repo, rid, sid, orderID, _, _ = newEditRepo()
	repo.lines[1].Status = "PREPARING"
	_, err = NewGuestCancelOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestCancelOrderRequest{OrderID: orderID})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Empty(t, repo.cancelled)
}

func TestGuestRequestCancelPreparingLineCreatesPendingRequest(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	repo.cancelLine = &domain.OrderLineForEdit{ID: lineA, OrderID: orderID, MenuItemID: repo.lines[0].MenuItemID, Status: "PREPARING", Quantity: 1}
	outbox := &fakeOutbox{}
	out, err := NewGuestRequestCancel(fakeTx{}, repo, outbox, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestRequestCancelRequest{OrderID: orderID, OrderItemID: lineA, Reason: "changed mind"})

	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, out.CancelRequestID)
	require.Equal(t, "PENDING", out.Status)
	require.Equal(t, "changed mind", repo.createdCancel.Reason)
	require.Equal(t, 1, outbox.writes)
}

func TestGuestRequestCancelRejectsDuplicateAndPendingLines(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	repo.cancelLine = &domain.OrderLineForEdit{ID: lineA, OrderID: orderID, MenuItemID: repo.lines[0].MenuItemID, Status: "PREPARING", Quantity: 1}
	repo.cancelExists = true
	_, err := NewGuestRequestCancel(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestRequestCancelRequest{OrderID: orderID, OrderItemID: lineA})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Nil(t, repo.createdCancel)

	repo, rid, sid, orderID, lineA, _ = newEditRepo()
	repo.cancelLine = &domain.OrderLineForEdit{ID: lineA, OrderID: orderID, MenuItemID: repo.lines[0].MenuItemID, Status: "PENDING", Quantity: 1}
	_, err = NewGuestRequestCancel(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestRequestCancelRequest{OrderID: orderID, OrderItemID: lineA})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Nil(t, repo.createdCancel)
}

func TestGuestOrderMutationsRejectInactiveSession(t *testing.T) {
	repo, rid, sid, orderID, lineA, _ := newEditRepo()
	repo.session.Status = "AWAITING_PAYMENT"
	_, err := NewGuestEditOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestEditOrderRequest{
		OrderID: orderID,
		Version: 1,
		Items:   []GuestEditOrderLineRequest{{OrderItemID: lineA, Quantity: 1}},
	})

	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Empty(t, repo.updated)
}
