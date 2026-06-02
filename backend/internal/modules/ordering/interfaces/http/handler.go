package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
)

type Handler struct {
	PlaceOrder          *application.PlaceOrder
	CancelOrEditItem    *application.CancelOrEditItem
	UpdateItemStatus    *application.UpdateItemStatus
	ReviewCancelRequest *application.ReviewCancelRequest
}

func NewHandler(placeOrder *application.PlaceOrder, cancelOrEditItem *application.CancelOrEditItem, updateItemStatus *application.UpdateItemStatus, reviewCancelRequest *application.ReviewCancelRequest) *Handler {
	return &Handler{
		PlaceOrder:          placeOrder,
		CancelOrEditItem:    cancelOrEditItem,
		UpdateItemStatus:    updateItemStatus,
		ReviewCancelRequest: reviewCancelRequest,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/ordering", auth.JWT(secret), auth.RBAC("SERVER", "KITCHEN", "MANAGER"))
	g.POST("/place-order", h.handle(h.PlaceOrder))
	g.POST("/cancel-or-edit-item", h.handle(h.CancelOrEditItem))
	g.POST("/update-item-status", h.handle(h.UpdateItemStatus))
	g.POST("/review-cancel-request", h.handle(h.ReviewCancelRequest))
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
