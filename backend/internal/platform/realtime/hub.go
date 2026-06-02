package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Topic struct {
	RestaurantID uuid.UUID
	Role         string
	TableID      uuid.UUID
}
type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type subscription struct {
	topic Topic
	conn  *websocket.Conn
	send  chan []byte
}

type Hub struct {
	mu       sync.RWMutex
	clients  map[*subscription]struct{}
	upgrader websocket.Upgrader
}

// NewHub builds the realtime hub. allowedOrigins gates the websocket upgrade
// against cross-site hijacking; when empty (env unset) any origin is accepted
// for dev convenience. Supply the staff and QR-guest frontend origins in prod.
func NewHub(allowedOrigins []string) *Hub {
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
	return &Hub{clients: map[*subscription]struct{}{}, upgrader: websocket.Upgrader{CheckOrigin: checkOrigin}}
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
	h.mu.Lock()
	h.clients[sub] = struct{}{}
	h.mu.Unlock()
	go h.writePump(sub)
	go h.readPump(sub)
}
func (h *Hub) Broadcast(_ Topic, event Event) error {
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.send <- b:
		default:
		}
	}
	return nil
}
func (h *Hub) writePump(s *subscription) {
	for msg := range s.send {
		if err := s.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
	_ = s.conn.Close()
}
func (h *Hub) readPump(s *subscription) {
	defer func() { h.mu.Lock(); delete(h.clients, s); h.mu.Unlock(); close(s.send); _ = s.conn.Close() }()
	for {
		if _, _, err := s.conn.ReadMessage(); err != nil {
			return
		}
	}
}
