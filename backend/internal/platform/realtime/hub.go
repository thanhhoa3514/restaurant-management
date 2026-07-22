package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	pongWait   = 60 * time.Second    // tối đa chờ Pong từ client
	pingPeriod = (pongWait * 9) / 10 // gửi Ping trước khi deadline để tránh race
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
			if err := s.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) readPump(s *subscription) {
	defer func() {
		h.mu.Lock()
		delete(h.clients, s)
		h.mu.Unlock()
		close(s.send)
		_ = s.conn.Close()
	}()

	s.conn.SetReadLimit(4096)
	s.conn.SetReadDeadline(time.Now().Add(pongWait))
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
		s.conn.SetReadDeadline(time.Now().Add(pongWait))
		if isInternalPing(msg) {
			continue
		}
	}
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
