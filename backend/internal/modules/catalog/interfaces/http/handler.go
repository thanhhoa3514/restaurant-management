package http

import (
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
	ListAdminMenuItems *application.ListAdminMenuItems
	GetAdminMenuItem   *application.GetAdminMenuItem
}

func NewHandler(createMenuItem *application.CreateMenuItem, updateMenuItem *application.UpdateMenuItem, deleteMenuItem *application.DeleteMenuItem, toggleAvailability *application.ToggleAvailability, listCategories *application.ListCategories, listMenuItems *application.ListMenuItems, getMenuItem *application.GetMenuItem, listAdminMenuItems *application.ListAdminMenuItems, getAdminMenuItem *application.GetAdminMenuItem) *Handler {
	return &Handler{
		CreateMenuItem:     createMenuItem,
		UpdateMenuItem:     updateMenuItem,
		DeleteMenuItem:     deleteMenuItem,
		ToggleAvailability: toggleAvailability,
		ListCategories:     listCategories,
		ListMenuItems:      listMenuItems,
		GetMenuItem:        getMenuItem,
		ListAdminMenuItems: listAdminMenuItems,
		GetAdminMenuItem:   getAdminMenuItem,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver) {
	g := r.Group("/catalog", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionCatalogManage))
	g.GET("/categories", h.listCategories)
	g.GET("/items", h.listAdminMenuItems)
	g.GET("/items/:id", h.getAdminMenuItem)
	g.POST("/create-menu-item", h.createMenuItem)
	g.POST("/update-menu-item", h.updateMenuItem)
	g.POST("/delete-menu-item", h.deleteMenuItem)
	g.POST("/toggle-availability", h.toggleAvailability)
}

func (h *Handler) RegisterGuestRoutes(g *gin.RouterGroup) {
	menu := g.Group("/menu")
	menu.GET("/categories", h.listCategories)
	menu.GET("/items", h.listMenuItems)
	menu.GET("/items/:id", h.getMenuItem)
}

func (h *Handler) listCategories(c *gin.Context) {
	out, err := h.ListCategories.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) listAdminMenuItems(c *gin.Context) {
	var req application.ListMenuItemsRequest
	if raw := c.Query("category_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid category_id", err))
			return
		}
		req.CategoryID = &id
	}
	out, err := h.ListAdminMenuItems.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) getAdminMenuItem(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid item id", err))
		return
	}
	out, err := h.GetAdminMenuItem.Handle(c.Request.Context(), application.GetMenuItemRequest{ItemID: id})
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

func (h *Handler) createMenuItem(c *gin.Context) {
	var req application.CreateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.CommandMetadata = commandMetadata(c)
	out, err := h.CreateMenuItem.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) updateMenuItem(c *gin.Context) {
	var req application.UpdateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.CommandMetadata = commandMetadata(c)
	out, err := h.UpdateMenuItem.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) deleteMenuItem(c *gin.Context) {
	var req application.DeleteMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.CommandMetadata = commandMetadata(c)
	out, err := h.DeleteMenuItem.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) toggleAvailability(c *gin.Context) {
	var req application.ToggleAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.CommandMetadata = commandMetadata(c)
	out, err := h.ToggleAvailability.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func commandMetadata(c *gin.Context) application.CommandMetadata {
	actorID, _ := uuid.Parse(c.GetString(auth.CtxUserID))
	traceID := c.GetHeader("X-Request-ID")
	if traceID == "" {
		traceID = c.Writer.Header().Get("X-Request-ID")
	}
	return application.CommandMetadata{
		ActorID:   actorID,
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		TraceID:   traceID,
	}
}
