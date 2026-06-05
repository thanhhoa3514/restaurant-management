package gateway

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"restaurant-management/internal/shared/apperr"
)

const defaultTimeout = 10 * time.Second

func clientOrDefault(client *http.Client) *http.Client {
	if client != nil {
		return client
	}
	return &http.Client{Timeout: defaultTimeout}
}

func hmacSHA256Hex(secret, data string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func verifyHMAC(secret, data, signature string) bool {
	expected := hmacSHA256Hex(secret, data)
	a, errA := hex.DecodeString(expected)
	b, errB := hex.DecodeString(strings.TrimSpace(signature))
	return errA == nil && errB == nil && hmac.Equal(a, b)
}

func gatewayString(v any) string {
	switch x := v.(type) {
	case float64:
		return strconv.FormatInt(int64(x), 10)
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}

func postJSON(client *http.Client, url string, req, out any) error {
	body, err := json.Marshal(req)
	if err != nil {
		return err
	}
	resp, err := client.Post(url, "application/json", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return apperr.New(apperr.CodeInternal, fmt.Sprintf("gateway returned http %d", resp.StatusCode))
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return apperr.Wrap(apperr.CodeInternal, "gateway returned invalid json", err)
	}
	return nil
}
