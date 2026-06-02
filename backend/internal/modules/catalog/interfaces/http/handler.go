package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	CreateMenuItem     *application.CreateMenuItem
	UpdateMenuItem     *application.UpdateMenuItem
	DeleteMenuItem     *application.DeleteMenuItem
	ToggleAvailability *application.ToggleAvailability
	ListCategories     *application.ListCategories
	ListMenuItems      *application.ListMenuItems
	GetMenuItem        *application.GetMenuItem
}

func NewHandler(createMenuItem *application.CreateMenuItem, updateMenuItem *application.UpdateMenuItem, deleteMenuItem *application.DeleteMenuItem, toggleAvailability *application.ToggleAvailability, listCategories *application.ListCategories, listMenuItems *application.ListMenuItems, getMenuItem *application.GetMenuItem) *Handler {
	return &Handler{
		CreateMenuItem:     createMenuItem,
		UpdateMenuItem:     updateMenuItem,
		DeleteMenuItem:     deleteMenuItem,
		ToggleAvailability: toggleAvailability,
		ListCategories:     listCategories,
		ListMenuItems:      listMenuItems,
		GetMenuItem:        getMenuItem,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/catalog", auth.JWT(secret), auth.RBAC("MANAGER"))
	g.POST("/create-menu-item", h.handle(h.CreateMenuItem))
	g.POST("/update-menu-item", h.handle(h.UpdateMenuItem))
	g.POST("/delete-menu-item", h.handle(h.DeleteMenuItem))
	g.POST("/toggle-availability", h.handle(h.ToggleAvailability))
}

func (h *Handler) RegisterGuestRoutes(g *gin.RouterGroup) {
	menu := g.Group("/menu")
	menu.GET("/categories", h.listCategories)
	menu.GET("/items", h.listMenuItems)
	menu.GET("/items/:id", h.getMenuItem)
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

func (h *Handler) listCategories(c *gin.Context) {
	out, err := h.ListCategories.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) listMenuItems(c *gin.Context) {
	var req application.ListMenuItemsRequest
	if raw := c.Query("category_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid category_id", err))
			return
		}
		req.CategoryID = &id
	}
	out, err := h.ListMenuItems.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) getMenuItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid item id", err))
		return
	}
	out, err := h.GetMenuItem.Handle(c.Request.Context(), application.GetMenuItemRequest{ItemID: id})
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
