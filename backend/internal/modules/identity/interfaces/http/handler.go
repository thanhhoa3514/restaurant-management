package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/identity/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
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
	g.POST("/authenticate", h.handle(h.Authenticate)) // public: login, no token yet
	admin := g.Group("", auth.JWT(secret), auth.RBAC("MANAGER"))
	admin.POST("/manage-users", h.handle(h.ManageUsers))
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
