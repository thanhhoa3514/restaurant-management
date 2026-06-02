package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
)

type Handler struct {
	CreateMenuItem     *application.CreateMenuItem
	UpdateMenuItem     *application.UpdateMenuItem
	DeleteMenuItem     *application.DeleteMenuItem
	ToggleAvailability *application.ToggleAvailability
}

func NewHandler(createMenuItem *application.CreateMenuItem, updateMenuItem *application.UpdateMenuItem, deleteMenuItem *application.DeleteMenuItem, toggleAvailability *application.ToggleAvailability) *Handler {
	return &Handler{
		CreateMenuItem:     createMenuItem,
		UpdateMenuItem:     updateMenuItem,
		DeleteMenuItem:     deleteMenuItem,
		ToggleAvailability: toggleAvailability,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/catalog", auth.JWT(secret), auth.RBAC("MANAGER"))
	g.POST("/create-menu-item", h.handle(h.CreateMenuItem))
	g.POST("/update-menu-item", h.handle(h.UpdateMenuItem))
	g.POST("/delete-menu-item", h.handle(h.DeleteMenuItem))
	g.POST("/toggle-availability", h.handle(h.ToggleAvailability))
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
