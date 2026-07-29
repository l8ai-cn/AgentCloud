package ampbearer

import (
	"errors"
	"net/url"
	"strings"
)

// AMP shards its OIDC endpoints per application, so the issuer of a business
// token identifies both the AMP deployment and the issuing application:
//
//	https://amp.example.com/api/v1/public/protocols/oidc/apps/ZHIYONG
//
// Agent Cloud trusts the deployment (matched against a configured SSO issuer)
// and separately whitelists which applications may assert identities.
const appsPathSegment = "/apps/"

var (
	ErrIssuerShape = errors.New("amp issuer does not have the expected app-scoped shape")
	ErrIssuerEmpty = errors.New("amp issuer is empty")
)

// SplitIssuer returns the deployment base (ending in "/apps/") and the app code.
func SplitIssuer(issuer string) (string, string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(issuer), "/")
	if trimmed == "" {
		return "", "", ErrIssuerEmpty
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" ||
		(parsed.Scheme != "https" && parsed.Scheme != "http") ||
		parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil {
		return "", "", ErrIssuerShape
	}
	cut := strings.LastIndex(trimmed, "/")
	if cut < 0 {
		return "", "", ErrIssuerShape
	}
	base, appCode := trimmed[:cut+1], trimmed[cut+1:]
	if appCode == "" || !strings.HasSuffix(base, appsPathSegment) {
		return "", "", ErrIssuerShape
	}
	return base, appCode, nil
}
