package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	Authenticate *application.Authenticate
	GetSession   *application.GetSession
	ManageUsers  *application.ManageUsers
	ListStaff    *application.ListStaff
	ListRoles    *application.ListRoles
}

func NewHandler(authenticate *application.Authenticate, getSession *application.GetSession, manageUsers *application.ManageUsers, listStaff *application.ListStaff, listRoles *application.ListRoles) *Handler {
	return &Handler{
		Authenticate: authenticate,
		GetSession:   getSession,
		ManageUsers:  manageUsers,
		ListStaff:    listStaff,
		ListRoles:    listRoles,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver) {
	g := r.Group("/identity")
	g.POST("/authenticate", h.authenticate) // public: login, no token yet
	authenticated := g.Group("", auth.JWT(secret))
	authenticated.GET("/me", h.me)
	admin := authenticated.Group("", auth.RequirePermission(resolver, auth.PermissionIdentityManage))
	admin.POST("/manage-users", h.manageUsers)
	admin.GET("/users", h.listStaff)
	admin.GET("/roles", h.listRoles)
	admin.GET("/dashboard", h.dashboard)
}

func (h *Handler) authenticate(c *gin.Context) {
	var req application.AuthenticateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.Authenticate.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) me(c *gin.Context) {
	restaurantID, ok := tenant.RestaurantID(c.Request.Context())
	if !ok {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant"))
		return
	}
	userID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || userID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	out, err := h.GetSession.Handle(c.Request.Context(), restaurantID, userID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) manageUsers(c *gin.Context) {
	var req application.ManageUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	restaurantID, ok := tenant.RestaurantID(c.Request.Context())
	if !ok {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant"))
		return
	}
	req.RestaurantID = restaurantID
	if actorID, err := uuid.Parse(c.GetString(auth.CtxUserID)); err == nil {
		req.ActorID = actorID
	}
	out, err := h.ManageUsers.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) listStaff(c *gin.Context) {
	out, err := h.ListStaff.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) listRoles(c *gin.Context) {
	out, err := h.ListRoles.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
