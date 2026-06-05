package http

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

func (h *Handler) RegisterWebhookRoutes(r *gin.RouterGroup) {
	r.POST("/billing/payments/webhook/:provider", h.paymentWebhook)
	if h.appEnv != "production" {
		r.POST("/billing/payments/mock/complete", h.mockCompletePayment)
	}
}

func (h *Handler) paymentWebhook(c *gin.Context) {
	if h.HandleWebhook == nil {
		httpx.RespondError(c, apperr.ErrNotImplemented)
		return
	}
	raw, err := c.GetRawData()
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid webhook body", err))
		return
	}
	out, err := h.HandleWebhook.Handle(c.Request.Context(), c.Param("provider"), raw, c.Request.Header)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	respondWebhookAck(c, out.Ack)
}

func (h *Handler) mockCompletePayment(c *gin.Context) {
	if h.HandleWebhook == nil {
		httpx.RespondError(c, apperr.ErrNotImplemented)
		return
	}
	var req struct {
		PaymentNumber string `json:"payment_number" binding:"required"`
		Result        string `json:"result"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.HandleWebhook.SimulateMock(c.Request.Context(), req.PaymentNumber, req.Result)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	if out.Invoice != nil {
		httpx.Respond(c, http.StatusOK, gin.H{"invoice": out.Invoice.Invoice}, nil)
		return
	}
	respondWebhookAck(c, out.Ack)
}

func respondWebhookAck(c *gin.Context, ack domain.WebhookAck) {
	status := ack.Status
	if status == 0 {
		status = http.StatusOK
	}
	if status == http.StatusNoContent {
		c.Status(status)
		return
	}
	body := ack.Body
	if body == nil {
		body = gin.H{"ok": true}
	}
	httpx.Respond(c, status, body, nil)
}
