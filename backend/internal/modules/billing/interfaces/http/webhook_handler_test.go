package http

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/billing/domain"
)

func TestRespondWebhookAckCanBypassAPIEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	respondWebhookAck(ctx, domain.WebhookAck{
		Status:    200,
		Body:      map[string]any{"success": true},
		Unwrapped: true,
	})

	if recorder.Code != 200 {
		t.Fatalf("status=%d, want 200", recorder.Code)
	}
	if recorder.Body.String() != `{"success":true}` {
		t.Fatalf("body=%q, want exact SePay acknowledgment", recorder.Body.String())
	}
}
