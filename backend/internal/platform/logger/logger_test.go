package logger

import (
	"context"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseLevel(t *testing.T) {
	cases := map[string]slog.Level{
		"debug":   slog.LevelDebug,
		"DEBUG":   slog.LevelDebug,
		"warn":    slog.LevelWarn,
		"warning": slog.LevelWarn,
		"error":   slog.LevelError,
		"info":    slog.LevelInfo,
		"":        slog.LevelInfo,
		"garbage": slog.LevelInfo,
		" debug ": slog.LevelDebug,
	}
	for in, want := range cases {
		require.Equalf(t, want, parseLevel(in), "parseLevel(%q)", in)
	}
}

func TestNewRespectsLevel(t *testing.T) {
	ctx := context.Background()

	debugLog := New("development", "debug")
	require.True(t, debugLog.Enabled(ctx, slog.LevelDebug))

	infoLog := New("development", "info")
	require.False(t, infoLog.Enabled(ctx, slog.LevelDebug))
	require.True(t, infoLog.Enabled(ctx, slog.LevelInfo))
}

func TestNewSetsDefault(t *testing.T) {
	l := New("production", "warn")
	require.Same(t, l, slog.Default())
}

func TestFromContextFallsBackToDefault(t *testing.T) {
	require.Same(t, slog.Default(), FromContext(context.Background()))
}

func TestWithContextRoundTrip(t *testing.T) {
	l := slog.New(slog.DiscardHandler)
	ctx := WithContext(context.Background(), l)
	require.Same(t, l, FromContext(ctx))
}
