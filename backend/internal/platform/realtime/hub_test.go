package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/auth"
)

// originReq builds a bare request carrying the given Origin header.
func originReq(origin string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	return req
}

func TestCheckOriginEmptyListAllowsAny(t *testing.T) {
	h := NewHub(nil, "", uuid.Nil, nil, nil)
	require.True(t, h.upgrader.CheckOrigin(originReq("https://anything.example")))
	require.True(t, h.upgrader.CheckOrigin(originReq("")))
}

func TestCheckOriginAllowsListed(t *testing.T) {
	h := NewHub([]string{"https://staff.example", "https://guest.example"}, "", uuid.Nil, nil, nil)
	require.True(t, h.upgrader.CheckOrigin(originReq("https://staff.example")))
	require.True(t, h.upgrader.CheckOrigin(originReq("https://guest.example")))
}

func TestCheckOriginRejectsUnlisted(t *testing.T) {
	h := NewHub([]string{"https://staff.example"}, "", uuid.Nil, nil, nil)
	require.False(t, h.upgrader.CheckOrigin(originReq("https://evil.example")))
	require.False(t, h.upgrader.CheckOrigin(originReq("")))
}

type fakeSessionChecker struct {
	valid bool
}

func (f fakeSessionChecker) IsSessionValid(context.Context, uuid.UUID) (bool, error) {
	return f.valid, nil
}

type fakeSessionValidator struct {
	session auth.SessionAuth
}

func (f fakeSessionValidator) ValidateSessionToken(context.Context, string) (auth.SessionAuth, error) {
	return f.session, nil
}

func TestAuthenticateStaffAndGuest(t *testing.T) {
	restaurantID := uuid.New()
	sessionID := uuid.New()
	tableID := uuid.New()
	h := NewHub(
		nil,
		"test-secret",
		restaurantID,
		fakeSessionChecker{valid: true},
		fakeSessionValidator{session: auth.SessionAuth{
			RestaurantID: restaurantID,
			SessionID:    sessionID,
			TableID:      tableID,
		}},
	)

	staffToken, err := auth.Issue("test-secret", auth.Claims{
		UserID:    uuid.NewString(),
		Role:      "SERVER",
		SessionID: uuid.NewString(),
	}, time.Hour)
	require.NoError(t, err)
	staffMessage, err := json.Marshal(authMessage{Type: "_auth", AccessToken: staffToken})
	require.NoError(t, err)
	staffTopic, err := h.authenticate(staffMessage)
	require.NoError(t, err)
	require.Equal(t, Topic{RestaurantID: restaurantID, Role: "SERVER"}, staffTopic)

	guestMessage, err := json.Marshal(authMessage{Type: "_auth", SessionToken: "guest-token"})
	require.NoError(t, err)
	guestTopic, err := h.authenticate(guestMessage)
	require.NoError(t, err)
	require.Equal(t, Topic{
		RestaurantID: restaurantID,
		Role:         "GUEST",
		TableID:      tableID,
		SessionID:    sessionID,
	}, guestTopic)
}

func TestTopicMatchingIsTenantAndGuestSessionScoped(t *testing.T) {
	restaurantID := uuid.New()
	otherRestaurantID := uuid.New()
	sessionID := uuid.New()
	tableID := uuid.New()

	staff := Topic{RestaurantID: restaurantID, Role: "KITCHEN"}
	guest := Topic{RestaurantID: restaurantID, Role: "GUEST", SessionID: sessionID, TableID: tableID}

	require.True(t, matches(staff, Topic{RestaurantID: restaurantID}, "billing.payment_completed"))
	require.False(t, matches(staff, Topic{RestaurantID: otherRestaurantID}, "ordering.order_placed"))
	require.True(t, matches(guest, Topic{RestaurantID: restaurantID, SessionID: sessionID}, "ordering.item_status_updated"))
	require.True(t, matches(guest, Topic{RestaurantID: restaurantID, SessionIDs: []uuid.UUID{uuid.New(), sessionID}}, "billing.payment_completed"))
	require.True(t, matches(guest, Topic{RestaurantID: restaurantID}, "catalog.item_updated"))
	require.False(t, matches(guest, Topic{RestaurantID: restaurantID, SessionID: uuid.New()}, "ordering.item_status_updated"))
	require.False(t, matches(guest, Topic{RestaurantID: otherRestaurantID, TableID: tableID}, "dining.waiter_called"))
}

func TestSameSubscriptionTopicIgnoresEventAudience(t *testing.T) {
	restaurantID := uuid.New()
	sessionID := uuid.New()
	base := Topic{RestaurantID: restaurantID, Role: "GUEST", SessionID: sessionID}
	withAudience := base
	withAudience.SessionIDs = []uuid.UUID{sessionID, uuid.New()}
	require.True(t, sameSubscriptionTopic(base, withAudience))
}
