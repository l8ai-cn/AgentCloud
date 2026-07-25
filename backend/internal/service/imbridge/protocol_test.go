package imbridge

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
	"github.com/stretchr/testify/require"
)

func TestDingTalkSignBase64(t *testing.T) {
	// Fixture from OpenClaw @soimy/dingtalk tests/unit/sign.test.ts
	got := dingtalkSign("1700000000000", "SECabc123")
	require.Equal(t, "N5P09a4+p1AMJIJWnIvQd2Yxw9+fu/oEBnPrjCcsLXk=", got)
}

func TestFeishuHeaderTokenVerify(t *testing.T) {
	p := &FeishuProvider{}
	cfg, _ := json.Marshal(feishuBridgeConfig{
		AppID: "a", AppSecret: "b", VerificationToken: "tok-v2",
	})
	body := []byte(`{"header":{"token":"tok-v2","event_type":"im.message.receive_v1"},"event":{}}`)
	require.NoError(t, p.VerifyWebhook(t.Context(), cfg, http.Header{}, body))

	bodyBad := []byte(`{"header":{"token":"wrong","event_type":"im.message.receive_v1"},"event":{}}`)
	require.Error(t, p.VerifyWebhook(t.Context(), cfg, http.Header{}, bodyBad))
}

func TestFeishuEncryptDecryptRoundTrip(t *testing.T) {
	key := "encrypt_key"
	plain := []byte(`{"challenge":"abc","type":"url_verification"}`)
	encrypted := encryptFeishuForTest(t, key, plain)

	out, err := decryptFeishuEncryptField(key, encrypted)
	require.NoError(t, err)
	require.JSONEq(t, string(plain), string(out))

	cfg, _ := json.Marshal(feishuBridgeConfig{
		AppID: "a", AppSecret: "b", VerificationToken: "t", EncryptKey: key,
	})
	p := &FeishuProvider{}
	body, _ := json.Marshal(map[string]string{"encrypt": encrypted})
	event, err := p.ParseInbound(t.Context(), cfg, http.Header{}, body)
	require.NoError(t, err)
	require.Equal(t, "abc", event.Challenge)
}

func TestComposeInboundMentions(t *testing.T) {
	content := composeInboundContent("ou_x", "@code-reviewer please look")
	require.Equal(t, 1, len(content.Blocks))
	els := content.Blocks[0].Elements
	require.GreaterOrEqual(t, len(els), 2)
	var found bool
	for _, el := range els {
		if el.Type == channelDomain.InlineMention && el.EntityKey == "code-reviewer" {
			found = true
			require.Equal(t, channelDomain.EntityPod, el.EntityType)
		}
	}
	require.True(t, found)
}

func TestInboundDedupeClaim(t *testing.T) {
	d := newInboundDedupe(0)
	require.True(t, d.Claim(t.Context(), 1, "m1"))
	require.False(t, d.Claim(t.Context(), 1, "m1"))
	require.True(t, d.Claim(t.Context(), 1, "m2"))
	require.True(t, d.Claim(t.Context(), 1, ""))
}

func encryptFeishuForTest(t *testing.T, encryptKey string, plaintext []byte) string {
	t.Helper()
	key := sha256.Sum256([]byte(encryptKey))
	block, err := aes.NewCipher(key[:])
	require.NoError(t, err)
	pad := aes.BlockSize - len(plaintext)%aes.BlockSize
	padded := append(append([]byte{}, plaintext...), bytesRepeat(byte(pad), pad)...)
	iv := make([]byte, aes.BlockSize)
	_, err = rand.Read(iv)
	require.NoError(t, err)
	ciphertext := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, padded)
	return base64.StdEncoding.EncodeToString(append(iv, ciphertext...))
}

func bytesRepeat(b byte, n int) []byte {
	out := make([]byte, n)
	for i := range out {
		out[i] = b
	}
	return out
}
