package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	BuildInvoice   *application.BuildInvoice
	AdjustInvoice  *application.AdjustInvoice
	ProcessPayment *application.ProcessPayment
	HandleWebhook  *application.HandleWebhook
	appEnv         string
}

func NewHandler(buildInvoice *application.BuildInvoice, adjustInvoice *application.AdjustInvoice, processPayment *application.ProcessPayment, handleWebhook *application.HandleWebhook, appEnv string) *Handler {
	return &Handler{BuildInvoice: buildInvoice, AdjustInvoice: adjustInvoice, ProcessPayment: processPayment, HandleWebhook: handleWebhook, appEnv: appEnv}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver) {
	g := r.Group("/billing", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionBillingProcess))
	g.POST("/build-invoice", h.buildInvoice)
	g.POST("/adjust-invoice", h.adjustInvoice)
	g.POST("/process-payment", h.processPayment)
}

func (h *Handler) buildInvoice(c *gin.Context) {
	var req application.BuildInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.BuildInvoice.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) adjustInvoice(c *gin.Context) {
	var req application.AdjustInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.AdjustInvoice.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) processPayment(c *gin.Context) {
	var req application.ProcessPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	req.ActorID = actorID
	out, err := h.ProcessPayment.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
