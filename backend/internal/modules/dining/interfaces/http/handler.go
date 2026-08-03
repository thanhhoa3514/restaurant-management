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
	OpenSession         *application.OpenSession
	JoinSession         *application.JoinSession
	CloseSession        *application.CloseSession
	ManageTableQR       *application.ManageTableQR
	ListTableQRs        *application.ListTableQRs
	ListGuestTables     *application.ListGuestTables
	MergeSessions       *application.MergeSessions
	SplitSessions       *application.SplitSessions
	ListPendingSessions *application.ListPendingSessions
	ApproveDevice       *application.ApproveDevice
	DeviceStatus        *application.DeviceStatus
	SaveTable           *application.SaveTable
	SaveTablePositions  *application.SaveTablePositions
	DeleteTable         *application.DeleteTable
	ListAreas           *application.ListAreas
	SaveArea            *application.SaveArea
	DeleteArea          *application.DeleteArea
	ListDailySessions   *application.ListDailySessions
	GetSessionDetail    *application.GetSessionDetail
	GetListTableTest    *application.ListTable
}

func (h *Handler) RegisterGuestRoutes(r *gin.RouterGroup, joinMiddleware ...gin.HandlerFunc) {
	joinHandlers := append(joinMiddleware, h.joinSession)
	r.POST("/sessions/join", joinHandlers...)
	r.GET("/sessions/device-status", h.deviceStatus)
	r.GET("/tables", h.listGuestTables)
	r.GET("/listtabletest", h.listTableTest)
}

func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup, secret string, resolver auth.PermissionResolver, defaultRestaurantID uuid.UUID) {
	staff := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningServe, defaultRestaurantID))
	staff.POST("/sessions", h.openSession)

	cashier := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningCashier, defaultRestaurantID))
	cashier.POST("/sessions/:sessionId/close", h.closeSession)

	manager := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningManage, defaultRestaurantID))
	manager.GET("/tables/qrs", h.listTableQRs)
	manager.POST("/tables/qrs", h.manageTableQR)
	manager.GET("/areas", h.listAreas)
	manager.POST("/areas", h.createArea)
	manager.PATCH("/areas/:areaId", h.updateArea)
	manager.DELETE("/areas/:areaId", h.deleteArea)
	manager.POST("/tables", h.createTable)
	manager.PATCH("/tables/positions", h.saveTablePositions)
	manager.PATCH("/tables/:tableId", h.updateTable)
	manager.DELETE("/tables/:tableId", h.deleteTable)
	manager.GET("/sessions/daily", h.listDailySessions)
	manager.GET("/sessions/daily/:sessionId", h.getSessionDetail)

	serve := r.Group("", auth.JWT(secret), auth.RequirePermission(resolver, auth.PermissionDiningServe, defaultRestaurantID))
	serve.POST("/sessions/merge", h.mergeSessions)
	serve.POST("/sessions/split", h.splitSessions)
	serve.GET("/sessions/pending-verification", h.listPendingSessions)
	serve.POST("/devices/:deviceId/verify", h.staffVerifyDevice)
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
	c.Header("Cache-Control", "no-store")
	var req application.JoinSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.IPHash = hashClientIP(c.ClientIP())
	req.ResumeAccessToken = c.GetHeader("X-Device-Access-Token")
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

func (h *Handler) listPendingSessions(c *gin.Context) {
	out, err := h.ListPendingSessions.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) staffVerifyDevice(c *gin.Context) {
	deviceID, err := uuid.Parse(c.Param("deviceId"))
	if err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid device id", err))
		return
	}
	actorID, err := uuid.Parse(c.GetString(auth.CtxUserID))
	if err != nil || actorID == uuid.Nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid user claim"))
		return
	}
	var body application.ApproveDeviceRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	body.DeviceID = deviceID
	body.ActorID = actorID
	out, err := h.ApproveDevice.Handle(c.Request.Context(), body)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) deviceStatus(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	out, err := h.DeviceStatus.Handle(c.Request.Context(), application.DeviceStatusRequest{
		AccessToken: c.GetHeader("X-Device-Access-Token"),
	})
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

func (h *Handler) listAreas(c *gin.Context) {
	out, err := h.ListAreas.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, gin.H{"areas": out}, nil)
}

func (h *Handler) createArea(c *gin.Context) {
	h.saveArea(c, nil)
}

func (h *Handler) updateArea(c *gin.Context) {
	areaID, err := uuid.Parse(c.Param("areaId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid area id"))
		return
	}
	h.saveArea(c, &areaID)
}

func (h *Handler) saveArea(c *gin.Context, areaID *uuid.UUID) {
	var req application.SaveAreaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.AreaID = areaID
	out, err := h.SaveArea.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	status := http.StatusOK
	if areaID == nil {
		status = http.StatusCreated
	}
	httpx.Respond(c, status, out, nil)
}

func (h *Handler) deleteArea(c *gin.Context) {
	areaID, err := uuid.Parse(c.Param("areaId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid area id"))
		return
	}
	if err := h.DeleteArea.Handle(c.Request.Context(), areaID); err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, gin.H{"id": areaID, "deleted": true}, nil)
}

func (h *Handler) createTable(c *gin.Context) {
	h.saveTable(c, nil)
}

func (h *Handler) updateTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("tableId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid table id"))
		return
	}
	h.saveTable(c, &tableID)
}

func (h *Handler) saveTablePositions(c *gin.Context) {
	var req application.SaveTablePositionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	if err := h.SaveTablePositions.Handle(c.Request.Context(), req); err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, gin.H{"saved": len(req.Positions)}, nil)
}

func (h *Handler) saveTable(c *gin.Context, tableID *uuid.UUID) {
	var req application.SaveTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
		return
	}
	req.TableID = tableID
	out, err := h.SaveTable.Handle(c.Request.Context(), req)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	status := http.StatusOK
	if out.Created {
		status = http.StatusCreated
	}
	httpx.Respond(c, status, out, nil)
}

func (h *Handler) deleteTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("tableId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid table id"))
		return
	}
	if err := h.DeleteTable.Handle(c.Request.Context(), tableID); err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, gin.H{"id": tableID, "deleted": true}, nil)
}

func (h *Handler) listDailySessions(c *gin.Context) {
	filter := application.ListDailySessionsFilter{
		Date:   c.Query("date"),
		Status: c.Query("status"),
		Search: c.Query("search"),
	}
	out, err := h.ListDailySessions.Handle(c.Request.Context(), filter)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}

func (h *Handler) getSessionDetail(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeInvalid, "invalid session id"))
		return
	}
	out, err := h.GetSessionDetail.Handle(c.Request.Context(), sessionID)
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
func (h *Handler) listTableTest(c *gin.Context) {
	out, err := h.GetListTableTest.Handle(c.Request.Context())
	if err != nil {
		httpx.RespondError(c, err)
		return
	}
	httpx.Respond(c, http.StatusOK, out, nil)
}
