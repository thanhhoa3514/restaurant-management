package http

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

func (h *Handler) RegisterKitchenRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/kitchen", auth.JWT(secret), auth.RBAC("KITCHEN", "MANAGER"))
	g.GET("/queue", func(c *gin.Context) { httpx.RespondError(c, apperr.ErrNotImplemented) })
	g.PATCH("/items/:id/status", func(c *gin.Context) { httpx.RespondError(c, apperr.ErrNotImplemented) })
	_ = http.StatusOK
}
