package http

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

// ComboHandler serves combo (set-menu) CRUD for staff and read-only combo
// listing/detail for guests. Staff routes are gated by PermissionCatalogManage;
// guest routes sit under the customer group alongside the à-la-carte menu.
type ComboHandler struct {
	CreateCombo             *application.CreateCombo
	UpdateCombo             *application.UpdateCombo
	DeleteCombo             *application.DeleteCombo
	ToggleComboAvailability *application.ToggleComboAvailability
	ListCombos              *application.ListCombos
	GetCombo                *application.GetCombo
	ListCombosAdmin         *application.ListCombosAdmin
	GetComboAdmin           *application.GetComboAdmin
}

func NewComboHandler(
	createCombo *application.CreateCombo,
	updateCombo *application.UpdateCombo,
	deleteCombo *application.DeleteCombo,
	toggleComboAvailability *application.ToggleComboAvailability,
	listCombos *application.ListCombos,
	getCombo *application.GetCombo,
	listCombosAdmin *application.ListCombosAdmin,
	getComboAdmin *application.GetComboAdmin,
) *ComboHandler {
	return &ComboHandler{
		CreateCombo:             createCombo,
		UpdateCombo:             updateCombo,
		DeleteCombo:             deleteCombo,
		ToggleComboAvailability: toggleComboAvailability,
		ListCombos:              listCombos,
		GetCombo:                getCombo,
		ListCombosAdmin:         listCombosAdmin,
		GetComboAdmin:           getComboAdmin,
	}
}

func (h *ComboHandler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	g := r.Group("/combos", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionCatalogManage, defaultRestaurantID))
	g.GET("", h.listCombosAdmin)
	g.GET("/:id", h.getComboAdmin)
	g.POST("", h.createCombo)
	g.PUT("/:id", h.updateCombo)
	g.DELETE("/:id", h.deleteCombo)
	g.PATCH("/:id/availability", h.toggleComboAvailability)
}

func (h *ComboHandler) RegisterGuestRoutes(r *gin.RouterGroup) {
	r.GET("/menu/combos", h.listCombos)
	r.GET("/menu/combos/:id", h.getCombo)
}

func (h *ComboHandler) listCombos(c *gin.Context) {
	out, err := h.ListCombos.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) getCombo(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid combo id", err))
		return
	}
	out, err := h.GetCombo.Handle(c.Request.Context(), application.GetComboRequest{ComboID: id})
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) listCombosAdmin(c *gin.Context) {
	var req application.ListCombosRequest
	if raw := c.Query("page"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			req.Page = v
		}
	}
	if raw := c.Query("page_size"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil {
			req.PageSize = v
		}
	}
	out, err := h.ListCombosAdmin.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) getComboAdmin(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid combo id", err))
		return
	}
	out, err := h.GetComboAdmin.Handle(c.Request.Context(), application.GetComboRequest{ComboID: id})
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) createCombo(c *gin.Context) {
	var req application.CreateComboRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.CommandMetadata = commandMetadata(c)
	out, err := h.CreateCombo.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) updateCombo(c *gin.Context) {
	comboID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid combo id", err))
		return
	}
	var req application.UpdateComboRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = comboID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.UpdateCombo.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) deleteCombo(c *gin.Context) {
	comboID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid combo id", err))
		return
	}
	var req application.DeleteComboRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = comboID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.DeleteCombo.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *ComboHandler) toggleComboAvailability(c *gin.Context) {
	comboID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid combo id", err))
		return
	}
	var req application.ToggleComboAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.ID = comboID
	req.CommandMetadata = commandMetadata(c)
	out, err := h.ToggleComboAvailability.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
