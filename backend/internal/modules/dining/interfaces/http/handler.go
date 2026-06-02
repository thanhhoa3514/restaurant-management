package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/application"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type Handler struct {
	OpenSession   *application.OpenSession
	JoinSession   *application.JoinSession
	CloseSession  *application.CloseSession
	ManageTableQR *application.ManageTableQR
}

func NewHandler(openSession *application.OpenSession, joinSession *application.JoinSession, closeSession *application.CloseSession, manageTableQR *application.ManageTableQR) *Handler {
	return &Handler{OpenSession: openSession, JoinSession: joinSession, CloseSession: closeSession, ManageTableQR: manageTableQR}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/dining")
	g.POST("/join-session", h.joinSession) // public: QR guest entry bootstrap
	staff := g.Group("", auth.JWT(secret), auth.RBAC("SERVER", "MANAGER"))
	staff.POST("/open-session", h.openSession)
	staff.POST("/close-session", h.closeSession)
	staff.POST("/manage-table-qr", h.manageTableQR)
}

func (h *Handler) openSession(c *gin.Context) {
	var req application.OpenSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	userID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || userID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	req.OpenedBy = userID
	out, err := h.OpenSession.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) joinSession(c *gin.Context) {
	var req application.JoinSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.JoinSession.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) closeSession(c *gin.Context) {
	var req application.CloseSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.CloseSession.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) manageTableQR(c *gin.Context) {
	var req application.ManageTableQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	out, err := h.ManageTableQR.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
