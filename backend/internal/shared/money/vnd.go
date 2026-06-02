package money

import "strconv"

type VND int64

func (v VND) Int64() int64 { return int64(v) }

func (v VND) String() string {
	n := int64(v)
	neg := n < 0
	if neg {
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	out := ""
	for len(s) > 3 {
		out = "." + s[len(s)-3:] + out
		s = s[:len(s)-3]
	}
	out = s + out + "đ"
	if neg {
		return "-" + out
	}
	return out
}
