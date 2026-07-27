package workerinterface

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func decodePayload(t *testing.T, encoded string) requestPayload {
	t.Helper()
	var payload requestPayload
	if err := json.Unmarshal([]byte(encoded), &payload); err != nil {
		t.Fatalf("payload is not valid json: %v", err)
	}
	return payload
}

func TestEncodeRequestCarriesMethodPathQueryAndBody(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/ignored?depth=2&focus=a",
		bytes.NewBufferString(`{"a":1}`),
	)

	encoded, err := EncodeRequest(req, "/graph/layers")
	if err != nil {
		t.Fatalf("EncodeRequest: %v", err)
	}

	payload := decodePayload(t, encoded)
	if payload.Method != http.MethodPost {
		t.Fatalf("method = %q", payload.Method)
	}
	if payload.Path != "/graph/layers" {
		t.Fatalf("path = %q", payload.Path)
	}
	if payload.Query != "depth=2&focus=a" {
		t.Fatalf("query = %q", payload.Query)
	}
	body, err := base64.StdEncoding.DecodeString(payload.BodyB64)
	if err != nil {
		t.Fatalf("body is not base64: %v", err)
	}
	if string(body) != `{"a":1}` {
		t.Fatalf("body = %q", body)
	}
}

func TestEncodeRequestDefaultsEmptyPathToRoot(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ignored", nil)

	encoded, err := EncodeRequest(req, "")
	if err != nil {
		t.Fatalf("EncodeRequest: %v", err)
	}

	if got := decodePayload(t, encoded).Path; got != "/" {
		t.Fatalf("path = %q, want /", got)
	}
}

func TestEncodeRequestDropsCredentialsAndHopByHopHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ignored", nil)
	req.Header.Set("Authorization", "Bearer embed-token")
	req.Header.Set("X-Api-Key", "amk_live")
	req.Header.Set("Cookie", "session=1")
	req.Header.Set("Connection", "keep-alive")
	req.Header.Set("Transfer-Encoding", "chunked")
	req.Header.Set("X-Course-Id", "course-1")

	encoded, err := EncodeRequest(req, "/health")
	if err != nil {
		t.Fatalf("EncodeRequest: %v", err)
	}

	headers := decodePayload(t, encoded).Headers
	for _, forbidden := range []string{
		"Authorization", "X-Api-Key", "Cookie", "Connection", "Transfer-Encoding", "Host",
	} {
		if _, leaked := headers[forbidden]; leaked {
			t.Fatalf("%s must not reach the pod", forbidden)
		}
	}
	if got := headers["X-Course-Id"]; len(got) != 1 || got[0] != "course-1" {
		t.Fatalf("X-Course-Id = %v, want forwarded", got)
	}
}

func TestEncodeRequestRejectsTraversalPaths(t *testing.T) {
	for _, path := range []string{"../etc/passwd", "/a/../../b", `/a\b`, "graph"} {
		req := httptest.NewRequest(http.MethodGet, "/ignored", nil)
		if _, err := EncodeRequest(req, path); !errors.Is(err, ErrInvalidPath) {
			t.Fatalf("path %q: err = %v, want ErrInvalidPath", path, err)
		}
	}
}

func TestEncodeRequestRejectsOversizedBody(t *testing.T) {
	req := httptest.NewRequest(
		http.MethodPost,
		"/ignored",
		strings.NewReader(strings.Repeat("x", MaxBodyBytes+1)),
	)

	if _, err := EncodeRequest(req, "/upload"); !errors.Is(err, ErrBodyTooLarge) {
		t.Fatalf("err = %v, want ErrBodyTooLarge", err)
	}
}

func TestValidateIDRejectsNonSlugValues(t *testing.T) {
	for _, id := range []string{"", "a", "Learning", "learning_companion", "../x", strings.Repeat("a", 101)} {
		if err := ValidateID(id); !errors.Is(err, ErrInvalidID) {
			t.Fatalf("id %q: err = %v, want ErrInvalidID", id, err)
		}
	}
	if err := ValidateID("learning-companion"); err != nil {
		t.Fatalf("ValidateID(learning-companion) = %v", err)
	}
}

func TestDecodeResponseStripsHopByHopHeadersAndDecodesBody(t *testing.T) {
	content, err := json.Marshal(Response{
		Status: http.StatusCreated,
		Headers: map[string][]string{
			"Content-Type":      {"application/json"},
			"Transfer-Encoding": {"chunked"},
		},
		BodyB64: base64.StdEncoding.EncodeToString([]byte(`{"ok":true}`)),
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	decoded, err := DecodeResponse(ResponseEncoding, string(content))
	if err != nil {
		t.Fatalf("DecodeResponse: %v", err)
	}

	if decoded.Status != http.StatusCreated {
		t.Fatalf("status = %d", decoded.Status)
	}
	if string(decoded.Body) != `{"ok":true}` {
		t.Fatalf("body = %q", decoded.Body)
	}
	if _, leaked := decoded.Headers["Transfer-Encoding"]; leaked {
		t.Fatal("hop-by-hop response header must be stripped")
	}
	if got := decoded.Headers["Content-Type"]; len(got) != 1 {
		t.Fatalf("Content-Type = %v", got)
	}
}

func TestDecodeResponseDefaultsMissingStatusToBadGateway(t *testing.T) {
	decoded, err := DecodeResponse(ResponseEncoding, `{"body_b64":""}`)
	if err != nil {
		t.Fatalf("DecodeResponse: %v", err)
	}
	if decoded.Status != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", decoded.Status)
	}
}

func TestDecodeResponseRejectsForeignEncodingAndGarbage(t *testing.T) {
	cases := []struct{ encoding, content string }{
		{"", `{"status":200}`},
		{"fs_read_v1", `{"status":200}`},
		{ResponseEncoding, ""},
		{ResponseEncoding, "not-json"},
		{ResponseEncoding, `{"status":200,"body_b64":"!!!"}`},
	}
	for _, tc := range cases {
		if _, err := DecodeResponse(tc.encoding, tc.content); !errors.Is(err, ErrInvalidResponse) {
			t.Fatalf("encoding=%q content=%q: err = %v", tc.encoding, tc.content, err)
		}
	}
}
