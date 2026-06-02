package http

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"restaurant-management/internal/modules/dining/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
)

type Handler struct {
	JoinSession   *application.JoinSession
	CloseSession  *application.CloseSession
	ManageTableQR *application.ManageTableQR
}

func NewHandler(joinSession *application.JoinSession, closeSession *application.CloseSession, manageTableQR *application.ManageTableQR) *Handler {
	return &Handler{
		JoinSession:   joinSession,
		CloseSession:  closeSession,
		ManageTableQR: manageTableQR,
	}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/dining")
	g.POST("/join-session", h.handle(h.JoinSession)) // public: QR guest entry
	staff := g.Group("", auth.JWT(secret), auth.RBAC("SERVER", "MANAGER"))
	staff.POST("/close-session", h.handle(h.CloseSession))
	staff.POST("/manage-table-qr", h.handle(h.ManageTableQR))
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
