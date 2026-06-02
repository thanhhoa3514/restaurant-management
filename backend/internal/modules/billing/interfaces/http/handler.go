package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/billing/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
)

type Handler struct {
	BuildInvoice   *application.BuildInvoice
	AdjustInvoice  *application.AdjustInvoice
	ProcessPayment *application.ProcessPayment
}

func NewHandler(buildInvoice *application.BuildInvoice, adjustInvoice *application.AdjustInvoice, processPayment *application.ProcessPayment) *Handler {
	return &Handler{
		BuildInvoice:   buildInvoice,
		AdjustInvoice:  adjustInvoice,
		ProcessPayment: processPayment,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/billing", auth.JWT(secret), auth.RBAC("CASHIER", "MANAGER"))
	g.POST("/build-invoice", h.handle(h.BuildInvoice))
	g.POST("/adjust-invoice", h.handle(h.AdjustInvoice))
	g.POST("/process-payment", h.handle(h.ProcessPayment))
}

func (h *Handler) handle(fn interface {
	Handle(context.Context, application.Input) (application.Output, error)
}) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in application.Input
		if err := c.ShouldBindJSON(&in); err != nil {
			httpx.RespondError(c, err)
			return
		}
		out, err := fn.Handle(c.Request.Context(), in)
		if err != nil {
			httpx.RespondError(c, err)
			return
		}
		httpx.Respond(c, http.StatusOK, out, nil)
	}
}
