package imbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// providerHTTPTimeout bounds every IM platform call. Without it a hung upstream
// blocks the webhook handler and the channel post-send hook indefinitely.
const providerHTTPTimeout = 15 * time.Second

const errorBodyMaxLen = 256

var defaultProviderClient = &http.Client{Timeout: providerHTTPTimeout}

type httpJSON struct {
	HTTP *http.Client
}

func (h httpJSON) client() *http.Client {
	if h.HTTP != nil {
		return h.HTTP
	}
	return defaultProviderClient
}

type httpStatusError struct {
	StatusCode int
	Body       string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("http %d: %s", e.StatusCode, e.Body)
}

// isPermanentError reports upstream rejections that will not succeed on retry
// and that justify latching a connection off (revoked credentials, deleted app).
func isPermanentError(err error) bool {
	var statusErr *httpStatusError
	if !errors.As(err, &statusErr) {
		return false
	}
	switch statusErr.StatusCode {
	case http.StatusRequestTimeout, http.StatusTooManyRequests:
		return false
	}
	return statusErr.StatusCode >= 400 && statusErr.StatusCode < 500
}

func truncateForStorage(s string) string {
	if len(s) <= errorBodyMaxLen {
		return s
	}
	return s[:errorBodyMaxLen] + "…"
}

func doJSONRequest(ctx context.Context, c *http.Client, method, rawURL string, headers map[string]string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		return &httpStatusError{StatusCode: resp.StatusCode, Body: truncateForStorage(string(data))}
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(data, out)
}

func parseInt64(s string) int64 {
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}
