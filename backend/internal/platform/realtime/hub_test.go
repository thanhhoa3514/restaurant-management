package realtime

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// originReq builds a bare request carrying the given Origin header.
func originReq(origin string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	return req
}

func TestCheckOriginEmptyListAllowsAny(t *testing.T) {
	h := NewHub(nil)
	require.True(t, h.upgrader.CheckOrigin(originReq("https://anything.example")))
	require.True(t, h.upgrader.CheckOrigin(originReq("")))
}

func TestCheckOriginAllowsListed(t *testing.T) {
	h := NewHub([]string{"https://staff.example", "https://guest.example"})
	require.True(t, h.upgrader.CheckOrigin(originReq("https://staff.example")))
	require.True(t, h.upgrader.CheckOrigin(originReq("https://guest.example")))
}

func TestCheckOriginRejectsUnlisted(t *testing.T) {
	h := NewHub([]string{"https://staff.example"})
	require.False(t, h.upgrader.CheckOrigin(originReq("https://evil.example")))
	require.False(t, h.upgrader.CheckOrigin(originReq("")))
}
