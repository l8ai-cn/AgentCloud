package workerinterface

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
)

const ResponseEncoding = "http_proxy_v1"

type Response struct {
	Status  int                 `json:"status"`
	Headers map[string][]string `json:"headers"`
	BodyB64 string              `json:"body_b64"`
}

type DecodedResponse struct {
	Status  int
	Headers map[string][]string
	Body    []byte
}

func DecodeResponse(encoding, content string) (DecodedResponse, error) {
	if encoding != ResponseEncoding || content == "" {
		return DecodedResponse{}, ErrInvalidResponse
	}
	var wire Response
	if err := json.Unmarshal([]byte(content), &wire); err != nil {
		return DecodedResponse{}, ErrInvalidResponse
	}
	body, err := base64.StdEncoding.DecodeString(wire.BodyB64)
	if err != nil {
		return DecodedResponse{}, ErrInvalidResponse
	}
	status := wire.Status
	if status <= 0 {
		status = http.StatusBadGateway
	}
	headers := make(map[string][]string, len(wire.Headers))
	for key, values := range wire.Headers {
		if SkipHopByHopHeader(key) {
			continue
		}
		headers[key] = append([]string(nil), values...)
	}
	return DecodedResponse{Status: status, Headers: headers, Body: body}, nil
}
