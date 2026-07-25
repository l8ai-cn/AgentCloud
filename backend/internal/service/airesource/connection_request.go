package airesource

import (
	"context"
	"net/http"
	"net/url"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/airesource"
)

func newCheckRequest(ctx context.Context, baseURL string, check domain.ConnectionCheck, credentials map[string]string) (*http.Request, error) {
	requestURL, err := checkURL(baseURL, check.Path)
	if err != nil {
		return nil, ErrInvalidEndpoint
	}
	request, err := http.NewRequestWithContext(ctx, check.Method, requestURL, nil)
	if err != nil {
		return nil, ErrValidation
	}
	if err := applyCheckAuthentication(request, check, credentials); err != nil {
		return nil, err
	}
	return request, nil
}

func checkURL(baseURL, checkPath string) (string, error) {
	base, err := url.Parse(baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return "", ErrInvalidEndpoint
	}
	joined, err := url.JoinPath(strings.TrimRight(baseURL, "/"), checkPath)
	if err != nil {
		return "", err
	}
	return joined, nil
}

func applyCheckAuthentication(request *http.Request, check domain.ConnectionCheck, credentials map[string]string) error {
	credential := strings.TrimSpace(credentials[check.CredentialKey])
	if credential == "" {
		return ErrInvalidCredentials
	}
	for _, header := range check.StaticHeaders {
		request.Header.Set(header.Name, header.Value)
	}
	switch check.AuthStrategy {
	case domain.ConnectionAuthBearer:
		request.Header.Set("Authorization", "Bearer "+credential)
	case domain.ConnectionAuthHeader:
		if check.AuthName == "" {
			return ErrValidation
		}
		request.Header.Set(check.AuthName, credential)
	case domain.ConnectionAuthQuery:
		if check.AuthName == "" {
			return ErrValidation
		}
		query := request.URL.Query()
		query.Set(check.AuthName, credential)
		request.URL.RawQuery = query.Encode()
	default:
		return ErrValidation
	}
	return nil
}
