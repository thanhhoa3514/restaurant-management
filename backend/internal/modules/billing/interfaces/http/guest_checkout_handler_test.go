package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/application"
	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/auth"
)

type checkoutRouteRepo struct {
	invoice *domain.Invoice
}

func (r checkoutRouteRepo) ListSessionInvoices(context.Context, uuid.UUID, uuid.UUID) ([]*domain.Invoice, error) {
	return []*domain.Invoice{r.invoice}, nil
}

func (checkoutRouteRepo) GuestSessionStatus(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "AWAITING_PAYMENT", nil
}

type checkoutSessionValidator struct {
	session auth.SessionAuth
}

func (v checkoutSessionValidator) ValidateSessionToken(context.Context, string) (auth.SessionAuth, error) {
	return v.session, nil
}

func TestGuestCheckoutRouteRequiresSessionAndReturnsQR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	restaurantID := uuid.New()
	sessionID := uuid.New()
	handler := &Handler{GuestCheckout: application.NewGuestCheckout(checkoutRouteRepo{
		invoice: &domain.Invoice{
			ID:              uuid.New(),
			DiningSessionID: sessionID,
			Status:          domain.InvoicePending,
			Payment: &domain.Payment{
				ID:            uuid.New(),
				PaymentNumber: "PAY0123456789ABCDEF",
				MethodCode:    "sepay",
				Status:        domain.PaymentProcessing,
				QRCodeURL:     "https://vietqr.app/img?acc=0000000001",
			},
		},
	}, restaurantID)}
	router := gin.New()
	group := router.Group("/api/v1/customer", auth.QRSessionToken(checkoutSessionValidator{
		session: auth.SessionAuth{
			RestaurantID: restaurantID,
			SessionID:    sessionID,
			TableID:      uuid.New(),
		},
	}))
	handler.RegisterGuestRoutes(group)

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/v1/customer/payment", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d, want 401", unauthorized.Code)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v1/customer/payment", nil)
	request.Header.Set("X-Session-Token", "guest-token")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if body := response.Body.String(); !containsAll(body, `"session_status":"AWAITING_PAYMENT"`, `"payment_number":"PAY0123456789ABCDEF"`, `"qr_code_url":"https://vietqr.app/img?acc=0000000001"`) {
		t.Fatalf("guest checkout response omitted QR fields: %s", body)
	}
}

func containsAll(value string, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(value, fragment) {
			return false
		}
	}
	return true
}
