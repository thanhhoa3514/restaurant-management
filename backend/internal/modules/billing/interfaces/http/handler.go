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
	BuildInvoice          *application.BuildInvoice
	AdjustInvoice         *application.AdjustInvoice
	ProcessPayment        *application.ProcessPayment
	CancelPayment         *application.CancelPayment
	ProcessPartialPayment *application.ProcessPartialPayment
	HandleWebhook         *application.HandleWebhook
	VoidInvoice           *application.VoidInvoice
	SplitInvoice          *application.SplitInvoice
	ListSessionInvoices   *application.ListSessionInvoices
	GuestCheckout         *application.GuestCheckout
	appEnv                string
}

func NewHandler(buildInvoice *application.BuildInvoice, adjustInvoice *application.AdjustInvoice, processPayment *application.ProcessPayment, cancelPayment *application.CancelPayment, processPartialPayment *application.ProcessPartialPayment, handleWebhook *application.HandleWebhook, voidInvoice *application.VoidInvoice, splitInvoice *application.SplitInvoice, listSessionInvoices *application.ListSessionInvoices, guestCheckout *application.GuestCheckout, appEnv string) *Handler {
	return &Handler{BuildInvoice: buildInvoice, AdjustInvoice: adjustInvoice, ProcessPayment: processPayment, CancelPayment: cancelPayment, ProcessPartialPayment: processPartialPayment, HandleWebhook: handleWebhook, VoidInvoice: voidInvoice, SplitInvoice: splitInvoice, ListSessionInvoices: listSessionInvoices, GuestCheckout: guestCheckout, appEnv: appEnv}
}

func (h *Handler) RegisterGuestRoutes(r *gin.RouterGroup) {
	r.GET("/payment", h.guestCheckout)
}

func (h *Handler) guestCheckout(c *gin.Context) {
	if h.GuestCheckout == nil {
		httpx.RespondError(c, apperr.ErrNotImplemented)
		return
	}
	out, err := h.GuestCheckout.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	g := r.Group("/invoices", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionBillingProcess, defaultRestaurantID))
	g.POST("", h.buildInvoice)
	g.GET("", h.listSessionInvoices)
	g.POST("/split", h.splitInvoice)
	g.POST("/:id/adjust", h.adjustInvoice)
	g.POST("/:id/void", h.voidInvoice)
	g.POST("/:id/pay", h.processPayment)
	g.POST("/:id/payments/:payment_id/cancel", h.cancelPayment)
	g.POST("/:id/pay-partial", h.processPartialPayment)
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

func (h *Handler) listSessionInvoices(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Query("dining_session_id"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "dining_session_id is required"))
		return
	}
	out, err := h.ListSessionInvoices.Handle(c.Request.Context(), sessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) splitInvoice(c *gin.Context) {
	var req application.SplitInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.SplitInvoice.Handle(c.Request.Context(), req)
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

func (h *Handler) processPartialPayment(c *gin.Context) {
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid invoice id", err))
		return
	}
	var req application.ProcessPartialPaymentRequest
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
	out, err := h.ProcessPartialPayment.Handle(c.Request.Context(), req)
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

func (h *Handler) cancelPayment(c *gin.Context) {
	invoiceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid invoice id", err))
		return
	}
	paymentID, err := uuid.Parse(c.Param("payment_id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid payment id", err))
		return
	}
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	out, err := h.CancelPayment.Handle(c.Request.Context(), application.CancelPaymentRequest{
		InvoiceID: invoiceID,
		PaymentID: paymentID,
		ActorID:   actorID,
	})
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
