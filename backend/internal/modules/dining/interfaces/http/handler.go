package http

import (
	"crypto/sha256"
	"encoding/hex"
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
	ListTableQRs  *application.ListTableQRs
}

func NewHandler(openSession *application.OpenSession, joinSession *application.JoinSession, closeSession *application.CloseSession, manageTableQR *application.ManageTableQR, listTableQRs *application.ListTableQRs) *Handler {
	return &Handler{OpenSession: openSession, JoinSession: joinSession, CloseSession: closeSession, ManageTableQR: manageTableQR, ListTableQRs: listTableQRs}
}

func (h *Handler) RegisterRoutes(r *gin.RouterGroup, secret string) {
	g := r.Group("/dining")
	g.POST("/join-session", h.joinSession) // public: QR guest entry bootstrap
	staff := g.Group("", auth.JWT(secret), auth.RBAC("SERVER", "MANAGER"))
	staff.POST("/open-session", h.openSession)
	staff.POST("/close-session", h.closeSession)

	// QR codes are tied to printed assets, so generate/rotate/listing is
	// restricted to MANAGER. Rotation deactivates the prior token.
	manager := g.Group("", auth.JWT(secret), auth.RBAC("MANAGER"))
	manager.GET("/table-qrs", h.listTableQRs)
	manager.POST("/manage-table-qr", h.manageTableQR)
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
	req.IPHash = hashClientIP(c.ClientIP())
	req.UserAgent = c.Request.UserAgent()
	req.TraceID = c.GetHeader("X-Request-ID")
	if req.TraceID == "" {
		req.TraceID = c.Writer.Header().Get("X-Request-ID")
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
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	req.ActorID = actorID
	out, err := h.ManageTableQR.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) listTableQRs(c *gin.Context) {
	out, err := h.ListTableQRs.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func hashClientIP(ip string) string {
	if ip == "" {
		return ""
	}
	sum := sha256.Sum256([]byte("qr-scan:" + ip))
	return hex.EncodeToString(sum[:16])
}
