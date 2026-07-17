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
	OpenSession     *application.OpenSession
	JoinSession     *application.JoinSession
	CloseSession    *application.CloseSession
	ManageTableQR   *application.ManageTableQR
	ListTableQRs    *application.ListTableQRs
	ListGuestTables *application.ListGuestTables
	MergeSessions   *application.MergeSessions
	SplitSessions   *application.SplitSessions
}

func NewHandler(openSession *application.OpenSession, joinSession *application.JoinSession, closeSession *application.CloseSession, manageTableQR *application.ManageTableQR, listTableQRs *application.ListTableQRs, listGuestTables *application.ListGuestTables, mergeSessions *application.MergeSessions, splitSessions *application.SplitSessions) *Handler {
	return &Handler{OpenSession: openSession, JoinSession: joinSession, CloseSession: closeSession, ManageTableQR: manageTableQR, ListTableQRs: listTableQRs, ListGuestTables: listGuestTables, MergeSessions: mergeSessions, SplitSessions: splitSessions}
}

func (h *Handler) RegisterGuestRoutes(r *gin.RouterGroup) {
	r.POST("/sessions/join", h.joinSession)
	r.GET("/tables", h.listGuestTables)
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	staff := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningServe, defaultRestaurantID))
	staff.POST("/sessions", h.openSession)

	cashier := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningCashier, defaultRestaurantID))
	cashier.POST("/sessions/:sessionId/close", h.closeSession)

	manager := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningManage, defaultRestaurantID))
	manager.GET("/tables/qrs", h.listTableQRs)
	manager.POST("/tables/qrs", h.manageTableQR)

	serve := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningServe, defaultRestaurantID))
	serve.POST("/sessions/merge", h.mergeSessions)
	serve.POST("/sessions/split", h.splitSessions)
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
	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid session id", err))
		return
	}
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	out, err := h.CloseSession.Handle(c.Request.Context(), application.CloseSessionRequest{
		SessionID: sessionID,
		ActorID:   actorID,
	})
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

func (h *Handler) listGuestTables(c *gin.Context) {
	out, err := h.ListGuestTables.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) mergeSessions(c *gin.Context) {
	var req application.MergeSessionsRequest
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
	out, err := h.MergeSessions.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) splitSessions(c *gin.Context) {
	var req application.SplitSessionsRequest
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
	out, err := h.SplitSessions.Handle(c.Request.Context(), req)
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
