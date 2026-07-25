package imbridge

import (
	"encoding/json"
	"strings"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
	"github.com/l8ai-cn/agentcloud/backend/pkg/crypto"
)

type configCipher struct {
	enc *crypto.Encryptor
}

func newConfigCipher(enc *crypto.Encryptor) *configCipher {
	return &configCipher{enc: enc}
}

func (c *configCipher) seal(raw json.RawMessage) (json.RawMessage, *string, error) {
	if c == nil || c.enc == nil || len(raw) == 0 {
		return raw, nil, nil
	}
	ciphertext, err := c.enc.Encrypt(string(raw))
	if err != nil {
		return nil, nil, err
	}
	return json.RawMessage(`{}`), &ciphertext, nil
}

func (c *configCipher) open(conn *domain.Connection) (json.RawMessage, error) {
	if conn == nil {
		return json.RawMessage(`{}`), nil
	}
	if conn.ConfigEncrypted != nil && strings.TrimSpace(*conn.ConfigEncrypted) != "" {
		if c == nil || c.enc == nil {
			return nil, ErrInvalidConfig
		}
		plain, err := c.enc.Decrypt(*conn.ConfigEncrypted)
		if err != nil {
			return nil, err
		}
		return json.RawMessage(plain), nil
	}
	if len(conn.Config) == 0 {
		return json.RawMessage(`{}`), nil
	}
	return conn.Config, nil
}

func redactConfig(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return json.RawMessage(`{}`)
	}
	for k, v := range m {
		if isSecretConfigKey(k) {
			if s, ok := v.(string); ok && s != "" {
				m[k] = "***"
			}
		}
	}
	out, err := json.Marshal(m)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return out
}

func isSecretConfigKey(key string) bool {
	switch strings.ToLower(key) {
	case "app_secret", "corp_secret", "signing_secret", "bot_token",
		"verification_token", "encoding_aes_key", "encrypt_key", "token":
		return true
	default:
		return false
	}
}
