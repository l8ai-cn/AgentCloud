package airesource

import (
	"context"
	"fmt"
	"io"
	"net/http"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
)

type HTTPDoer interface {
	Do(request *http.Request) (*http.Response, error)
}

type HTTPConnectionProber struct{ client HTTPDoer }

func NewHTTPConnectionProber(client HTTPDoer) (*HTTPConnectionProber, error) {
	if client == nil {
		return nil, fmt.Errorf("HTTP client is required")
	}
	return &HTTPConnectionProber{client: client}, nil
}

func (prober *HTTPConnectionProber) Probe(ctx context.Context, input ProbeInput) error {
	if input.Provider.ConnectionCheck.AuthStrategy == domain.ConnectionAuthUnsupported {
		return ErrProbeUnsupported
	}
	request, err := newCheckRequest(ctx, input.BaseURL, input.Provider.ConnectionCheck, input.Credentials)
	if err != nil {
		return err
	}
	response, err := prober.client.Do(request)
	if err != nil {
		return fmt.Errorf("%w: provider request failed", ErrValidation)
	}
	defer response.Body.Close()
	_, _ = io.CopyN(io.Discard, response.Body, 4096)
	return checkResponseError(input.Provider.Key.String(), response.StatusCode)
}

func checkResponseError(providerKey string, statusCode int) error {
	switch {
	case statusCode == http.StatusUnauthorized, statusCode == http.StatusForbidden:
		return ErrInvalidCredentials
	case statusCode == http.StatusNotFound:
		return ErrProviderEndpointUnavailable
	case statusCode == http.StatusConflict && seedanceAuthProbe(providerKey):
		// Seedance/Doubao expose a POST-only create path; GET returns 409 once
		// credentials are accepted, so treat that as a successful auth probe.
		return nil
	case statusCode < 200 || statusCode >= 300:
		return fmt.Errorf("%w: provider status %d", ErrValidation, statusCode)
	default:
		return nil
	}
}

func seedanceAuthProbe(providerKey string) bool {
	return providerKey == "sub2api-seedance" || providerKey == "doubao"
}
