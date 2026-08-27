package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/shared/apperr"
)

type fakeTx struct{}

func (fakeTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeOrderRepo struct {
	session      *domain.SessionForOrder
	items        map[uuid.UUID]*domain.MenuItemForOrder
	variants     map[uuid.UUID]*domain.VariantForOrder
	groups       map[uuid.UUID][]domain.OptionGroupRule
	options      map[uuid.UUID]*domain.OptionForOrder
	prior        bool
	created      *domain.OrderCreate
	sessionTotal int64
	view         domain.OrderView
}

func (r *fakeOrderRepo) LockSessionForOrder(context.Context, uuid.UUID, uuid.UUID) (*domain.SessionForOrder, error) {
	if r.session == nil {
		return nil, apperr.New(apperr.CodeNotFound, "session not found")
	}
	return r.session, nil
}
func (r *fakeOrderRepo) FindMenuItemForOrder(_ context.Context, _ uuid.UUID, id uuid.UUID) (*domain.MenuItemForOrder, error) {
	item := r.items[id]
	if item == nil {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	return item, nil
}
func (r *fakeOrderRepo) FindVariantForOrder(_ context.Context, _ uuid.UUID, _ uuid.UUID, id uuid.UUID) (*domain.VariantForOrder, error) {
	variant := r.variants[id]
	if variant == nil {
		return nil, apperr.New(apperr.CodeNotFound, "variant not found")
	}
	return variant, nil
}
func (r *fakeOrderRepo) ListOptionGroupRules(_ context.Context, _ uuid.UUID, itemID uuid.UUID) ([]domain.OptionGroupRule, error) {
	return r.groups[itemID], nil
}
func (r *fakeOrderRepo) ListOptionsForOrder(_ context.Context, _ uuid.UUID, _ uuid.UUID, ids []uuid.UUID) ([]domain.OptionForOrder, error) {
	out := []domain.OptionForOrder{}
	for _, id := range ids {
		if opt := r.options[id]; opt != nil {
			out = append(out, *opt)
		}
	}
	return out, nil
}
func (r *fakeOrderRepo) HasPriorOrders(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return r.prior, nil
}
func (r *fakeOrderRepo) CreateOrderGraph(_ context.Context, order *domain.OrderCreate) error {
	order.ID = uuid.New()
	for i := range order.Lines {
		order.Lines[i].ID = uuid.New()
	}
	r.created = order
	return nil
}
func (r *fakeOrderRepo) SessionTotal(context.Context, uuid.UUID, uuid.UUID) (int64, error) {
	if r.sessionTotal == 0 && r.created != nil {
		for _, line := range r.created.Lines {
			r.sessionTotal += line.TotalAmountVND
		}
	}
	return r.sessionTotal, nil
}
func (r *fakeOrderRepo) ViewSessionOrders(context.Context, uuid.UUID, uuid.UUID) (domain.OrderView, error) {
	return r.view, nil
}

type fakeOutbox struct{ writes int }

func (f *fakeOutbox) Write(context.Context, any) error { f.writes++; return nil }

func guestOrderCtx(rid, sid, tableID uuid.UUID) context.Context {
	ctx := context.Background()
	return guest.WithSession(ctx, guest.Session{SessionID: sid, TableID: tableID})
}

func baseRepo() (*fakeOrderRepo, uuid.UUID, uuid.UUID, uuid.UUID) {
	rid := uuid.New()
	sid := uuid.New()
	tableID := uuid.New()
	itemID := uuid.New()
	return &fakeOrderRepo{session: &domain.SessionForOrder{ID: sid, RestaurantID: rid, TableID: tableID, Status: "ACTIVE"}, items: map[uuid.UUID]*domain.MenuItemForOrder{itemID: {ID: itemID, Code: "M1", Name: "Hotpot", BasePriceVND: 100000, Station: "HOTPOT", Orderable: true}}, variants: map[uuid.UUID]*domain.VariantForOrder{}, groups: map[uuid.UUID][]domain.OptionGroupRule{}, options: map[uuid.UUID]*domain.OptionForOrder{}}, rid, sid, itemID
}

func TestGuestPlaceOrderMoneyMathAndInitial(t *testing.T) {
	repo, rid, sid, itemID := baseRepo()
	groupID := uuid.New()
	optA := uuid.New()
	optB := uuid.New()
	repo.groups[itemID] = []domain.OptionGroupRule{{ID: groupID, Name: "Toppings", SelectionType: "MULTIPLE", MaxSelections: ptrInt(3)}}
	repo.options[optA] = &domain.OptionForOrder{ID: optA, GroupID: groupID, Name: "A", GroupName: "Toppings", PriceDeltaVND: 5000}
	repo.options[optB] = &domain.OptionForOrder{ID: optB, GroupID: groupID, Name: "B", GroupName: "Toppings", PriceDeltaVND: 3000}
	outbox := &fakeOutbox{}
	svc := NewGuestPlaceOrder(fakeTx{}, repo, outbox, rid)

	out, err := svc.Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{Items: []GuestOrderLineRequest{{MenuItemID: itemID, Quantity: 3, Options: []GuestOrderOptionRequest{{OptionID: optA, Quantity: 2}, {OptionID: optB, Quantity: 1}}}}})

	require.NoError(t, err)
	require.Equal(t, "INITIAL", out.OrderType)
	require.Len(t, out.Items, 1)
	require.EqualValues(t, 13000, out.Items[0].OptionsTotalVND)
	require.EqualValues(t, 339000, out.Items[0].SubtotalVND)
	require.EqualValues(t, 339000, out.Items[0].TotalAmountVND)
	require.EqualValues(t, 339000, out.SessionTotalVND)
	require.Equal(t, "PENDING", out.Items[0].Status)
	require.Equal(t, "HOTPOT", out.Items[0].Station)
	require.Equal(t, 1, outbox.writes)
}

func TestGuestPlaceOrderAdditionalAndTickets(t *testing.T) {
	repo, rid, sid, itemID := baseRepo()
	repo.prior = true
	second := uuid.New()
	repo.items[second] = &domain.MenuItemForOrder{ID: second, Code: "M2", Name: "Drink", BasePriceVND: 20000, Station: "", Orderable: true}
	svc := NewGuestPlaceOrder(fakeTx{}, repo, nil, rid)
	out, err := svc.Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{Items: []GuestOrderLineRequest{{MenuItemID: itemID, Quantity: 1}, {MenuItemID: second, Quantity: 1}}})

	require.NoError(t, err)
	require.Equal(t, "ADDITIONAL", out.OrderType)
	require.Len(t, repo.created.KitchenTickets, 2)
	stations := []string{repo.created.KitchenTickets[0].Station, repo.created.KitchenTickets[1].Station}
	require.Contains(t, stations, "HOTPOT")
	require.Contains(t, stations, "GENERAL")
}

func TestBuildKitchenTicketsSkipsComboParentWithoutReindexing(t *testing.T) {
	parent := uuid.New()
	lines := []domain.OrderLineCreate{
		{ID: parent, IsComboParent: true, ItemNameSnapshot: "Set Nướng"},
		{ID: uuid.New(), ParentOrderItemID: &parent, Station: "GRILL", ItemNameSnapshot: "Ba chỉ bò"},
		{ID: uuid.New(), ParentOrderItemID: &parent, Station: "DRINK", ItemNameSnapshot: "Trà đào"},
	}

	tickets, err := buildKitchenTickets(lines)
	require.NoError(t, err)
	require.Len(t, tickets, 2)
	for _, ticket := range tickets {
		require.NotContains(t, ticket.ItemIndexes, 0)
	}
	var grill, drink []int
	for _, ticket := range tickets {
		switch ticket.Station {
		case "GRILL":
			grill = ticket.ItemIndexes
		case "DRINK":
			drink = ticket.ItemIndexes
		}
	}
	require.Equal(t, []int{1}, grill)
	require.Equal(t, []int{2}, drink)
}

func TestGuestPlaceOrderValidationErrors(t *testing.T) {
	repo, rid, sid, itemID := baseRepo()
	repo.items[itemID].Orderable = false
	badQty := uuid.New()
	repo.items[badQty] = &domain.MenuItemForOrder{ID: badQty, Name: "Bad", BasePriceVND: 1, Orderable: true}
	requiredItem := uuid.New()
	groupID := uuid.New()
	repo.items[requiredItem] = &domain.MenuItemForOrder{ID: requiredItem, Name: "Req", BasePriceVND: 1, Orderable: true}
	repo.groups[requiredItem] = []domain.OptionGroupRule{{ID: groupID, Name: "Sauce", SelectionType: "SINGLE", IsRequired: true, MinSelections: 1}}
	svc := NewGuestPlaceOrder(fakeTx{}, repo, nil, rid)
	_, err := svc.Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{Items: []GuestOrderLineRequest{{MenuItemID: itemID, Quantity: 1}, {MenuItemID: badQty, Quantity: 0}, {MenuItemID: requiredItem, Quantity: 1}}})

	require.Error(t, err)
	var verr *CartValidationError
	require.ErrorAs(t, err, &verr)
	reasons := []string{}
	for _, le := range verr.LineErrors {
		reasons = append(reasons, le.Reason)
	}
	require.Contains(t, reasons, "unavailable")
	require.Contains(t, reasons, "invalid_quantity")
	require.Contains(t, reasons, "missing_required_option")
	require.Nil(t, repo.created)
}

func TestGuestPlaceOrderOptionCountOutOfRange(t *testing.T) {
	repo, rid, sid, itemID := baseRepo()
	groupID := uuid.New()
	optA := uuid.New()
	optB := uuid.New()
	repo.groups[itemID] = []domain.OptionGroupRule{{ID: groupID, Name: "Sauce", SelectionType: "MULTIPLE", MaxSelections: ptrInt(1)}}
	repo.options[optA] = &domain.OptionForOrder{ID: optA, GroupID: groupID, Name: "A", GroupName: "Sauce"}
	repo.options[optB] = &domain.OptionForOrder{ID: optB, GroupID: groupID, Name: "B", GroupName: "Sauce"}
	_, err := NewGuestPlaceOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{Items: []GuestOrderLineRequest{{MenuItemID: itemID, Quantity: 1, Options: []GuestOrderOptionRequest{{OptionID: optA, Quantity: 1}, {OptionID: optB, Quantity: 1}}}}})
	var verr *CartValidationError
	require.ErrorAs(t, err, &verr)
	require.Equal(t, "option_count_out_of_range", verr.LineErrors[0].Reason)
}

func TestGuestPlaceOrderSessionGateRejectsNonActive(t *testing.T) {
	repo, rid, sid, itemID := baseRepo()
	repo.session.Status = "AWAITING_PAYMENT"
	_, err := NewGuestPlaceOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{Items: []GuestOrderLineRequest{{MenuItemID: itemID, Quantity: 1}}})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
	require.Nil(t, repo.created)
}

func TestGuestPlaceOrderEmptyItemsInvalid(t *testing.T) {
	repo, rid, sid, _ := baseRepo()
	_, err := NewGuestPlaceOrder(fakeTx{}, repo, nil, rid).Handle(guestOrderCtx(rid, sid, uuid.New()), GuestPlaceOrderRequest{})
	require.True(t, apperr.Is(err, apperr.CodeInvalid))
}

func TestGuestViewOrders(t *testing.T) {
	rid := uuid.New()
	sid := uuid.New()
	itemID := uuid.New()
	repo := &fakeOrderRepo{view: domain.OrderView{SessionTotalVND: 123, Orders: []domain.OrderRead{{ID: uuid.New(), OrderNumber: "ORD", OrderType: "INITIAL", Status: "SUBMITTED", Items: []domain.OrderItemRead{{ID: uuid.New(), MenuItemID: itemID, NameSnapshot: "N", Quantity: 1, UnitPriceVND: 123, TotalAmountVND: 123, Status: "PENDING", Station: "GENERAL", Options: []domain.OrderOptionRead{{NameSnapshot: "O", PriceDeltaSnapshotVND: 3, Quantity: 1}}}}}}}}
	out, err := NewGuestViewOrders(repo, rid).Handle(guestOrderCtx(rid, sid, uuid.New()))
	require.NoError(t, err)
	require.EqualValues(t, 123, out.SessionTotalVND)
	require.Len(t, out.Orders, 1)
	require.Len(t, out.Orders[0].Items[0].Options, 1)

	repo.view = domain.OrderView{Orders: []domain.OrderRead{}, SessionTotalVND: 0}
	out, err = NewGuestViewOrders(repo, rid).Handle(guestOrderCtx(rid, sid, uuid.New()))
	require.NoError(t, err)
	require.Empty(t, out.Orders)
}

func ptrInt(v int) *int { return &v }
