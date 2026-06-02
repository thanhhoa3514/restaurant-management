package http

import (
	"github.com/gin-gonic/gin"

	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

func (h *Handler) RegisterWebhookRoutes(r *gin.RouterGroup) {
	r.POST("/billing/payments/webhook", func(c *gin.Context) { httpx.RespondError(c, apperr.ErrNotImplemented) })
}
