package http

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	GuestPlaceOrder       *application.GuestPlaceOrder
	GuestViewOrders       *application.GuestViewOrders
	GuestEditOrder        *application.GuestEditOrder
	GuestCancelOrder      *application.GuestCancelOrder
	GuestRequestCancel    *application.GuestRequestCancel
	StaffTables           *application.StaffTables
	StaffRequestBill      *application.StaffRequestBill
	StaffReopenSession    *application.StaffReopenSession
	GuestCallWaiter       *application.GuestCallWaiter
	StaffAckWaiterCall    *application.StaffAckWaiterCall
	StaffUpdateStatus     *application.StaffUpdateItemStatus
	StaffMarkUnavailable  *application.StaffMarkUnavailable
	StaffTakeawayOrder    *application.StaffTakeawayOrder
	KitchenQueue          *application.KitchenQueue
	KitchenListCancels    *application.KitchenListCancelRequests
	KitchenReviewCancel   *application.KitchenReviewCancelRequest
}

func NewHandler(guestPlaceOrder *application.GuestPlaceOrder,
	guestViewOrders *application.GuestViewOrders, guestEditOrder *application.GuestEditOrder,
	guestCancelOrder *application.GuestCancelOrder, guestRequestCancel *application.GuestRequestCancel,
	staffTables *application.StaffTables, staffRequestBill *application.StaffRequestBill,
	staffReopenSession *application.StaffReopenSession,
	guestCallWaiter *application.GuestCallWaiter,
	staffAckWaiterCall *application.StaffAckWaiterCall,
	staffUpdateStatus *application.StaffUpdateItemStatus,
	staffMarkUnavailable *application.StaffMarkUnavailable,
	staffTakeawayOrder *application.StaffTakeawayOrder,
	kitchenQueue *application.KitchenQueue,
	kitchenListCancels *application.KitchenListCancelRequests,
	kitchenReviewCancel *application.KitchenReviewCancelRequest) *Handler {
	return &Handler{
		GuestPlaceOrder:       guestPlaceOrder,
		GuestViewOrders:       guestViewOrders,
		GuestEditOrder:        guestEditOrder,
		GuestCancelOrder:      guestCancelOrder,
		GuestRequestCancel:    guestRequestCancel,
		StaffTables:           staffTables,
		StaffRequestBill:      staffRequestBill,
		StaffReopenSession:    staffReopenSession,
		GuestCallWaiter:       guestCallWaiter,
		StaffAckWaiterCall:    staffAckWaiterCall,
		StaffUpdateStatus:     staffUpdateStatus,
		StaffMarkUnavailable:  staffMarkUnavailable,
		StaffTakeawayOrder:    staffTakeawayOrder,
		KitchenQueue:          kitchenQueue,
		KitchenListCancels:    kitchenListCancels,
		KitchenReviewCancel:   kitchenReviewCancel,
	}
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string,
	resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	g := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionOrderingStaff, defaultRestaurantID))
	g.GET("/tables", h.staffTables)
	g.POST("/sessions/:sessionId/request-bill", h.staffRequestBill)
	g.POST("/sessions/:sessionId/reopen", h.staffReopenSession)
	g.POST("/sessions/:sessionId/ack-waiter-call", h.staffAckWaiterCall)
	g.PATCH("/order-items/:itemId/status", h.staffUpdateItemStatus)
	g.POST("/order-items/:itemId/unavailable", h.staffMarkUnavailable)
	g.POST("/orders/takeaway", h.staffTakeawayOrder)
}

func (h *Handler) staffTakeawayOrder(c *gin.Context) {
	var req application.StaffTakeawayOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	actorID := uuid.MustParse(c.GetString(auth.CtxUserID))
	out, err := h.StaffTakeawayOrder.Handle(c.Request.Context(), req, actorID)
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

func (h *Handler) staffMarkUnavailable(c *gin.Context) {
	itemID, err := uuidFromParam(c, "itemId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	var req application.MarkUnavailableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	var actorID *uuid.UUID
	if id, err := uuid.Parse(c.GetString(auth.CtxUserID)); err == nil && id != uuid.Nil {
		actorID = &id
	}
	out, err := h.StaffMarkUnavailable.Handle(c.Request.Context(), itemID, req.Reason, actorID, c.GetString(auth.CtxRole))
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) RegisterGuestRoutes(r *gin.RouterGroup) {
	r.POST("/orders", h.guestPlaceOrder)
	r.GET("/orders", h.guestViewOrders)
	r.PUT("/orders/:orderId/items", h.guestEditOrder)
	r.DELETE("/orders/:orderId", h.guestCancelOrder)
	r.POST("/orders/:orderId/cancel-requests", h.guestRequestCancel)
	r.POST("/request-bill", h.guestRequestBill)
	r.POST("/call-waiter", h.guestCallWaiter)
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
	c.JSON(status, gin.H{
		"code":        status,
		"data":        nil,
		"error":       gin.H{"code": string(ae.Code), "message": ae.Message},
		"line_errors": lineErrors,
	})
}

func (h *Handler) guestRequestBill(c *gin.Context) {
	gs, ok := guest.SessionFromContext(c.Request.Context())
	if !ok || gs.SessionID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing guest session"))
		return
	}
	out, err := h.StaffRequestBill.Handle(c.Request.Context(), gs.SessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) guestCallWaiter(c *gin.Context) {
	gs, ok := guest.SessionFromContext(c.Request.Context())
	if !ok || gs.SessionID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing guest session"))
		return
	}
	out, err := h.GuestCallWaiter.Handle(c.Request.Context(), gs.SessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffAckWaiterCall(c *gin.Context) {
	sessionID, err := uuidFromParam(c, "sessionId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	out, err := h.StaffAckWaiterCall.Handle(c.Request.Context(), sessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffTables(c *gin.Context) {
	out, err := h.StaffTables.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffRequestBill(c *gin.Context) {
	sessionID, err := uuidFromParam(c, "sessionId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	out, err := h.StaffRequestBill.Handle(c.Request.Context(), sessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffReopenSession(c *gin.Context) {
	sessionID, err := uuidFromParam(c, "sessionId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	out, err := h.StaffReopenSession.Handle(c.Request.Context(), sessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffUpdateItemStatus(c *gin.Context) {
	itemID, err := uuidFromParam(c, "itemId")
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	var req application.UpdateItemStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	var actorID *uuid.UUID
	if id, err := uuid.Parse(c.GetString(auth.CtxUserID)); err == nil && id != uuid.Nil {
		actorID = &id
	}
	out, err := h.StaffUpdateStatus.Handle(c.Request.Context(), itemID, req.Status, actorID, c.GetString(auth.CtxRole))
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func statusForLineCode(code apperr.Code) int {
	if code == apperr.CodeConflict {
		return http.StatusConflict
	}
	return http.StatusBadRequest
}
