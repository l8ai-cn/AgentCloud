package imbridge

import (
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"github.com/l8ai-cn/agentcloud/backend/pkg/i18n"
)

// senderLabel is the product name, not copy, so it stays out of the locale files.
const senderLabel = "Agent Cloud"

// stopPrompt is fed to the agent, which reasons in English regardless of the
// IM workspace language.
const stopPrompt = "User requested stop via IM /stop. Please stop current work."

// botText renders bot-authored copy in the connection's language. The audience
// is the IM workspace, so the locale comes from the connection rather than from
// any signed-in AgentsMesh user.
func botText(conn *domain.Connection, key string, args ...any) string {
	return i18n.TWithLocale(connectionLocale(conn), "im_bridge."+key, args...)
}

func connectionLocale(conn *domain.Connection) string {
	if conn == nil || conn.Locale == "" {
		return domain.LocaleChinese
	}
	return conn.Locale
}

func DefaultLocaleForProvider(provider string) string {
	if NormalizeProvider(provider) == domain.ProviderSlack {
		return domain.LocaleEnglish
	}
	return domain.LocaleChinese
}

func IsSupportedLocale(locale string) bool {
	for _, supported := range domain.SupportedLocales {
		if locale == supported {
			return true
		}
	}
	return false
}
