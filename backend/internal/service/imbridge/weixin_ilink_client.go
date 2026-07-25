package imbridge

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type ilinkClient struct {
	http *http.Client
}

func newIlinkClient(httpClient *http.Client) *ilinkClient {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &ilinkClient{http: httpClient}
}

func randomWechatUIN() string {
	var buf [4]byte
	_, _ = rand.Read(buf[:])
	n := uint32(buf[0])<<24 | uint32(buf[1])<<16 | uint32(buf[2])<<8 | uint32(buf[3])
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d", n)))
}

func (c *ilinkClient) headers(bodyLen *int, token string) http.Header {
	h := make(http.Header)
	h.Set("iLink-App-Id", ilinkAppID)
	h.Set("iLink-App-ClientVersion", fmt.Sprintf("%d", ilinkAppClientVersion))
	h.Set("X-WECHAT-UIN", randomWechatUIN())
	if bodyLen != nil {
		h.Set("Content-Type", "application/json")
	}
	if token != "" {
		h.Set("AuthorizationType", ilinkAuthType)
		h.Set("Authorization", "Bearer "+token)
	}
	return h
}

func (c *ilinkClient) getJSON(ctx context.Context, baseURL, endpoint string) (map[string]any, error) {
	url := baseURL + "/" + strings.TrimPrefix(endpoint, "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header = c.headers(nil, "")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ilink GET %s: HTTP %d: %s", endpoint, resp.StatusCode, string(body))
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *ilinkClient) postJSON(ctx context.Context, baseURL, endpoint, token string, payload any) (map[string]any, error) {
	url := baseURL + "/" + strings.TrimPrefix(endpoint, "/")
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	n := len(b)
	req.Header = c.headers(&n, token)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ilink POST %s: HTTP %d: %s", endpoint, resp.StatusCode, string(body))
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out, nil
}
