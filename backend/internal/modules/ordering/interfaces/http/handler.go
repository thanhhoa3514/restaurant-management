package http

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	PlaceOrder          *application.PlaceOrder
	CancelOrEditItem    *application.CancelOrEditItem
	UpdateItemStatus    *application.UpdateItemStatus
	ReviewCancelRequest *application.ReviewCancelRequest
	GuestPlaceOrder     *application.GuestPlaceOrder
	GuestViewOrders     *application.GuestViewOrders
	GuestEditOrder      *application.GuestEditOrder
	GuestCancelOrder    *application.GuestCancelOrder
	GuestRequestCancel  *application.GuestRequestCancel
}

func NewHandler(placeOrder *application.PlaceOrder, cancelOrEditItem *application.CancelOrEditItem, updateItemStatus *application.UpdateItemStatus, reviewCancelRequest *application.ReviewCancelRequest, guestPlaceOrder *application.GuestPlaceOrder, guestViewOrders *application.GuestViewOrders, guestEditOrder *application.GuestEditOrder, guestCancelOrder *application.GuestCancelOrder, guestRequestCancel *application.GuestRequestCancel) *Handler {
	return &Handler{
		PlaceOrder:          placeOrder,
		CancelOrEditItem:    cancelOrEditItem,
		UpdateItemStatus:    updateItemStatus,
		ReviewCancelRequest: reviewCancelRequest,
		GuestPlaceOrder:     guestPlaceOrder,
		GuestViewOrders:     guestViewOrders,
		GuestEditOrder:      guestEditOrder,
		GuestCancelOrder:    guestCancelOrder,
		GuestRequestCancel:  guestRequestCancel,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/ordering", auth.JWT(secret), auth.RBAC("SERVER", "KITCHEN", "MANAGER"))
	g.POST("/place-order", h.handle(h.PlaceOrder))
	g.POST("/cancel-or-edit-item", h.handle(h.CancelOrEditItem))
	g.POST("/update-item-status", h.handle(h.UpdateItemStatus))
	g.POST("/review-cancel-request", h.handle(h.ReviewCancelRequest))
}

func (h *Handler) RegisterGuestRoutes(g *gin.RouterGroup) {
	g.POST("/orders", h.guestPlaceOrder)
	g.GET("/orders", h.guestViewOrders)
	g.PUT("/orders/:orderId/items", h.guestEditOrder)
	g.DELETE("/orders/:orderId", h.guestCancelOrder)
	g.POST("/orders/:orderId/cancel-requests", h.guestRequestCancel)
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

func (h *Handler) guestPlaceOrder(c *gin.Context) {
	var req application.GuestPlaceOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.GuestPlaceOrder.Handle(c.Request.Context(), req)
	if err != nil {
		var validationErr *application.CartValidationError
		if errors.As(err, &validationErr) {
			respondLineErrors(c, http.StatusBadRequest, validationErr.AppError(), validationErr.LineErrors)
			return
		}
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) guestViewOrders(c *gin.Context) {
	out, err := h.GuestViewOrders.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) guestEditOrder(c *gin.Context) {
	orderID, err := uuidFromParam(c, "orderId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	var req application.GuestEditOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.OrderID = orderID
	out, err := h.GuestEditOrder.Handle(c.Request.Context(), req)
	if err != nil {
		var lineErr *application.LineOperationError
		if errors.As(err, &lineErr) {
			respondLineErrors(c, statusForLineCode(lineErr.Code), apperr.New(lineErr.Code, lineErr.Message), lineErr.LineErrors)
			return
		}
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) guestCancelOrder(c *gin.Context) {
	orderID, err := uuidFromParam(c, "orderId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	out, err := h.GuestCancelOrder.Handle(c.Request.Context(), application.GuestCancelOrderRequest{OrderID: orderID})
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) guestRequestCancel(c *gin.Context) {
	orderID, err := uuidFromParam(c, "orderId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	var req application.GuestRequestCancelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.OrderID = orderID
	out, err := h.GuestRequestCancel.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusCreated, out, nil)
}

func uuidFromParam(c *gin.Context, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		return uuid.Nil, apperr.Wrap(apperr.CodeInvalid, "invalid "+name, err)
	}
	return id, nil
}

func respondLineErrors(c *gin.Context, status int, ae *apperr.Error, lineErrors []application.LineError) {
	c.JSON(status, gin.H{"data": nil, "error": gin.H{"code": string(ae.Code), "message": ae.Message}, "line_errors": lineErrors})
}

func statusForLineCode(code apperr.Code) int {
	if code == apperr.CodeConflict {
		return http.StatusConflict
	}
	return http.StatusBadRequest
}
