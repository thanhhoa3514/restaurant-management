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
	VoidInvoice    *application.VoidInvoice
	appEnv         string
}

func NewHandler(buildInvoice *application.BuildInvoice, adjustInvoice *application.AdjustInvoice, processPayment *application.ProcessPayment, handleWebhook *application.HandleWebhook, voidInvoice *application.VoidInvoice, appEnv string) *Handler {
	return &Handler{BuildInvoice: buildInvoice, AdjustInvoice: adjustInvoice, ProcessPayment: processPayment, HandleWebhook: handleWebhook, VoidInvoice: voidInvoice, appEnv: appEnv}
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	g := r.Group("/invoices", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionBillingProcess, defaultRestaurantID))
	g.POST("", h.buildInvoice)
	g.POST("/:id/adjust", h.adjustInvoice)
	g.POST("/:id/void", h.voidInvoice)
	g.POST("/:id/pay", h.processPayment)
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
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid invoice id", err))
		return
	}
	var req application.AdjustInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.InvoiceID = invoiceID
	out, err := h.AdjustInvoice.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) voidInvoice(c *gin.Context) {
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid invoice id", err))
		return
	}
	var req application.VoidInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.InvoiceID = invoiceID
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	req.ActorID = actorID
	out, err := h.VoidInvoice.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) processPayment(c *gin.Context) {
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid invoice id", err))
		return
	}
	var req application.ProcessPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.InvoiceID = invoiceID
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
