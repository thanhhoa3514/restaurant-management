package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

func (h *Handler) RegisterKitchenRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/kitchen", auth.JWT(secret), auth.RBAC("KITCHEN", "MANAGER"))
	g.GET("/queue", h.kitchenQueue)
	g.PATCH("/items/:id/status", h.kitchenUpdateItemStatus)
}

func (h *Handler) kitchenQueue(c *gin.Context) {
	out, err := h.KitchenQueue.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) kitchenUpdateItemStatus(c *gin.Context) {
	itemID, err := uuidFromParam(c, "id")
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
