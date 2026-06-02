package money

import "testing"

import "github.com/stretchr/testify/require"

func TestVNDString(t *testing.T) {
	require.Equal(t, "85.000đ", VND(85000).String())
	require.Equal(t, "-1.000đ", VND(-1000).String())
}
