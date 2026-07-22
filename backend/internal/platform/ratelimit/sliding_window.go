package ratelimit

import (
	"sync"
	"time"
)

// SlidingWindow is an in-memory sliding window rate limiter.
// It tracks request timestamps per key and allows up to limit
// requests within a sliding time window.
type SlidingWindow struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	buckets  map[string][]time.Time
	stopCh   chan struct{}
}

// NewSlidingWindow creates a rate limiter that allows up to `limit`
// requests per `window` duration for each unique key.
func NewSlidingWindow(limit int, window time.Duration) *SlidingWindow {
	sw := &SlidingWindow{
		limit:   limit,
		window:  window,
		buckets: make(map[string][]time.Time),
		stopCh:  make(chan struct{}),
	}
	go sw.cleanup()
	return sw
}

// Allow checks whether a request for the given key is allowed.
// Returns true if the request is within the rate limit.
func (sw *SlidingWindow) Allow(key string) bool {
	return sw.AllowN(key, 1)
}

// AllowN checks whether n requests for the given key are allowed.
func (sw *SlidingWindow) AllowN(key string, n int) bool {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-sw.window)

	// Get or create the bucket
	history := sw.buckets[key]

	// Prune timestamps outside the window
	cut := 0
	for i, t := range history {
		if t.After(windowStart) {
			break
		}
		cut = i + 1
	}
	if cut > 0 {
		history = history[cut:]
	}

	// Check limit
	if len(history)+n > sw.limit {
		sw.buckets[key] = history
		return false
	}

	// Record request(s)
	for i := 0; i < n; i++ {
		history = append(history, now)
	}
	sw.buckets[key] = history
	return true
}

// cleanup periodically purges stale entries to prevent memory leaks.
// Runs every window duration.
func (sw *SlidingWindow) cleanup() {
	ticker := time.NewTicker(sw.window)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sw.mu.Lock()
			now := time.Now()
			windowStart := now.Add(-sw.window)
			for key, history := range sw.buckets {
				cut := 0
				for i, t := range history {
					if t.After(windowStart) {
						break
					}
					cut = i + 1
				}
				if cut >= len(history) {
					delete(sw.buckets, key)
				} else if cut > 0 {
					sw.buckets[key] = history[cut:]
				}
			}
			sw.mu.Unlock()
		case <-sw.stopCh:
			return
		}
	}
}

// Stop terminates the cleanup goroutine.
func (sw *SlidingWindow) Stop() {
	close(sw.stopCh)
}
