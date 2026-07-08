package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/storage"
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
	Storage            *storage.Client // S3-compatible storage for image uploads
}

func NewHandler(createMenuItem *application.CreateMenuItem, updateMenuItem *application.UpdateMenuItem, deleteMenuItem *application.DeleteMenuItem, toggleAvailability *application.ToggleAvailability, listCategories *application.ListCategories, listMenuItems *application.ListMenuItems, getMenuItem *application.GetMenuItem, listAdminMenuItems *application.ListAdminMenuItems, getAdminMenuItem *application.GetAdminMenuItem, storage *storage.Client) *Handler {
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
		Storage:            storage,
	}
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	g := r.Group("/menu", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionCatalogManage, defaultRestaurantID))
	g.GET("/categories", h.listCategories)
	g.GET("/items", h.listAdminMenuItems)
	g.GET("/items/:id", h.getAdminMenuItem)
	g.POST("/items", h.createMenuItem)
	g.PUT("/items/:id", h.updateMenuItem)
	g.DELETE("/items/:id", h.deleteMenuItem)
	g.PATCH("/items/:id/availability", h.toggleAvailability)
	if h.Storage != nil {
		g.POST("/upload/presign", h.presignUpload)
	}
}

func (h *Handler) RegisterGuestRoutes(r *gin.RouterGroup) {
	r.GET("/menu/categories", h.listCategories)
	r.GET("/menu/items", h.listMenuItems)
	r.GET("/menu/items/:id", h.getMenuItem)
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
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid item id", err))
		return
	}
	var req application.UpdateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = itemID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.UpdateMenuItem.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) deleteMenuItem(c *gin.Context) {
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid item id", err))
		return
	}
	var req application.DeleteMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = itemID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.DeleteMenuItem.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) toggleAvailability(c *gin.Context) {
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid item id", err))
		return
	}
	var req application.ToggleAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = itemID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.ToggleAvailability.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) presignUpload(c *gin.Context) {
	var req struct {
		Extension   string `json:"extension" binding:"required"`   // e.g. ".jpg", ".png"
		ContentType string `json:"content_type" binding:"required"` // e.g. "image/jpeg"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request", err))
		return
	}

	result, err := h.Storage.PresignedPutURL(c.Request.Context(), req.Extension, 15*time.Minute)
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInternal, "failed to generate upload url", err))
		return
	}

	httpx.Respond(c, http.StatusOK, result, nil)
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
