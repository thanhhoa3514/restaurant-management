package postgres

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
)

func TestIsUniqueViolation(t *testing.T) {
	require.True(t, IsUniqueViolation(&pgconn.PgError{Code: "23505"}))
	require.False(t, IsUniqueViolation(&pgconn.PgError{Code: "23503"}))
	require.False(t, IsUniqueViolation(errors.New("nope")))
}
