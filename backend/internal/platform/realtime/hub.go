package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"restaurant-management/internal/platform/auth"
)

const (
	pongWait    = 60 * time.Second    // tối đa chờ Pong từ client
	pingPeriod  = (pongWait * 9) / 10 // gửi Ping trước khi deadline để tránh race
	authTimeout = 10 * time.Second
)

type Topic struct {
	RestaurantID uuid.UUID
	Role         string
	TableID      uuid.UUID
	SessionID    uuid.UUID
	// SessionIDs is used only for event fan-out. Authenticated subscriptions use
	// SessionID; keeping the audience list on the event topic lets staff receive
	// one event while every guest session in a merged bill receives it too.
	SessionIDs []uuid.UUID
}
type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type subscription struct {
	topic       Topic
	authPayload []byte
	conn        *websocket.Conn
	send        chan []byte
}

type Hub struct {
	mu                    sync.RWMutex
	clients               map[*subscription]struct{}
	upgrader              websocket.Upgrader
	staffSecret           string
	defaultRestaurantID   uuid.UUID
	sessionChecker        auth.SessionChecker
	deviceAccessValidator auth.DeviceAccessValidator
}

func NewHub(allowedOrigins []string, staffSecret string, defaultRestaurantID uuid.UUID, sessionChecker auth.SessionChecker, deviceAccessValidator auth.DeviceAccessValidator) *Hub {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}
	checkOrigin := func(r *http.Request) bool {
		if len(allowed) == 0 {
			return true
		}
		_, ok := allowed[r.Header.Get("Origin")]
		return ok
	}
	return &Hub{
		clients:               map[*subscription]struct{}{},
		upgrader:              websocket.Upgrader{CheckOrigin: checkOrigin},
		staffSecret:           staffSecret,
		defaultRestaurantID:   defaultRestaurantID,
		sessionChecker:        sessionChecker,
		deviceAccessValidator: deviceAccessValidator,
	}
}
func (h *Hub) Run(ctx context.Context) {
	<-ctx.Done()
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		_ = c.conn.Close()
		delete(h.clients, c)
	}
}
func (h *Hub) ServeGin(c *gin.Context) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	sub := &subscription{conn: conn, send: make(chan []byte, 8)}
	go h.writePump(sub)
	go h.readPump(sub)
}
func (h *Hub) Broadcast(topic Topic, event Event) error {
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		if !matches(c.topic, topic, event.Type) {
			continue
		}
		select {
		case c.send <- b:
		default:
		}
	}
	return nil
}

func matches(subscriber, event Topic, eventType string) bool {
	if subscriber.RestaurantID == uuid.Nil || subscriber.RestaurantID != event.RestaurantID {
		return false
	}
	if subscriber.Role != "GUEST" {
		return subscriber.Role != ""
	}
	if strings.HasPrefix(eventType, "catalog.") {
		return true
	}
	if event.SessionID != uuid.Nil && subscriber.SessionID == event.SessionID {
		return true
	}
	for _, sessionID := range event.SessionIDs {
		if sessionID != uuid.Nil && subscriber.SessionID == sessionID {
			return true
		}
	}
	return event.TableID != uuid.Nil && subscriber.TableID == event.TableID
}

func (h *Hub) writePump(s *subscription) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = s.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-s.send:
			if !ok {
				return // channel đã đóng
			}
			if err := s.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			topic, err := h.authenticate(s.authPayload)
			if err != nil || !sameSubscriptionTopic(topic, s.topic) {
				return
			}
			if err := s.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func sameSubscriptionTopic(a, b Topic) bool {
	return a.RestaurantID == b.RestaurantID &&
		a.Role == b.Role &&
		a.TableID == b.TableID &&
		a.SessionID == b.SessionID
}

func (h *Hub) readPump(s *subscription) {
	authenticated := false
	defer func() {
		h.mu.Lock()
		delete(h.clients, s)
		h.mu.Unlock()
		close(s.send)
		_ = s.conn.Close()
	}()

	s.conn.SetReadLimit(4096)
	s.conn.SetReadDeadline(time.Now().Add(authTimeout))
	s.conn.SetPongHandler(func(string) error {
		s.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	s.conn.SetPingHandler(func(string) error {
		s.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, msg, err := s.conn.ReadMessage()
		if err != nil {
			return
		}
		if !authenticated {
			topic, err := h.authenticate(msg)
			if err != nil {
				_ = s.conn.WriteControl(
					websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "authentication failed"),
					time.Now().Add(time.Second),
				)
				return
			}
			s.topic = topic
			s.authPayload = append([]byte(nil), msg...)
			h.mu.Lock()
			h.clients[s] = struct{}{}
			h.mu.Unlock()
			authenticated = true
			s.conn.SetReadDeadline(time.Now().Add(pongWait))
			ack, _ := json.Marshal(Event{Type: "_auth_ok", Payload: map[string]any{"role": topic.Role}})
			select {
			case s.send <- ack:
			default:
				return
			}
			continue
		}
		s.conn.SetReadDeadline(time.Now().Add(pongWait))
		if isInternalPing(msg) {
			// Reply so the client sees inbound traffic and keeps its own
			// inactivity monitor from closing an otherwise-healthy socket.
			pong, _ := json.Marshal(Event{Type: "_pong"})
			select {
			case s.send <- pong:
			default:
			}
			continue
		}
	}
}

type authMessage struct {
	Type              string `json:"type"`
	AccessToken       string `json:"access_token"`
	DeviceAccessToken string `json:"device_access_token"`
}

func (h *Hub) authenticate(raw []byte) (Topic, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var message authMessage
	if err := json.Unmarshal(raw, &message); err != nil || message.Type != "_auth" {
		return Topic{}, errors.New("authentication message required")
	}
	if token := strings.TrimSpace(message.AccessToken); token != "" {
		if h.sessionChecker == nil || h.staffSecret == "" || h.defaultRestaurantID == uuid.Nil {
			return Topic{}, errors.New("staff authentication unavailable")
		}
		claims, err := auth.Parse(token, h.staffSecret)
		if err != nil || strings.TrimSpace(claims.Role) == "" {
			return Topic{}, errors.New("invalid staff token")
		}
		sessionID, err := uuid.Parse(claims.SessionID)
		if err != nil || sessionID == uuid.Nil {
			return Topic{}, errors.New("staff session claim required")
		}
		valid, err := h.sessionChecker.IsSessionValid(ctx, sessionID)
		if err != nil || !valid {
			return Topic{}, errors.New("staff session revoked")
		}
		return Topic{RestaurantID: h.defaultRestaurantID, Role: strings.ToUpper(claims.Role)}, nil
	}
	if token := strings.TrimSpace(message.DeviceAccessToken); token != "" {
		if h.deviceAccessValidator == nil {
			return Topic{}, errors.New("guest authentication unavailable")
		}
		session, err := h.deviceAccessValidator.ValidateAccessToken(ctx, token)
		if err != nil {
			return Topic{}, errors.New("invalid guest session")
		}
		return Topic{
			RestaurantID: session.RestaurantID,
			Role:         "GUEST",
			TableID:      session.TableID,
			SessionID:    session.SessionID,
		}, nil
	}
	return Topic{}, errors.New("authentication token required")
}

func isInternalPing(msg []byte) bool {
	var v struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(msg, &v); err != nil {
		return false
	}
	return v.Type == "_ping"
}
