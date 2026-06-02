package http

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/identity/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	Authenticate *application.Authenticate
	ManageUsers  *application.ManageUsers
}

func NewHandler(authenticate *application.Authenticate, manageUsers *application.ManageUsers) *Handler {
	return &Handler{
		Authenticate: authenticate,
		ManageUsers:  manageUsers,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/identity")
	g.POST("/authenticate", h.authenticate) // public: login, no token yet
	admin := g.Group("", auth.JWT(secret), auth.RBAC("MANAGER"))
	admin.POST("/manage-users", h.manageUsers)
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

func (h *Handler) manageUsers(c *gin.Context) {
	var req application.ManageUsersRequest
	restaurantID, ok := tenant.RestaurantID(c.Request.Context())
	if !ok {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant"))
		return
	}
	req.RestaurantID = restaurantID
	out, err := h.ManageUsers.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
