package imbridge

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"

	channelDomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/channel"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
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


func TestApplyRouteMention(t *testing.T) {
	require.Equal(t, "hello", applyRouteMention("hello", nil))
	require.Equal(t, "@coder hello", applyRouteMention("hello", &routeResolution{
		TargetKind: "pod", TargetRef: "coder",
	}))
	require.Equal(t, "@coder please", applyRouteMention("@coder please", &routeResolution{
		TargetKind: "pod", TargetRef: "coder",
	}))
}

func TestChunkText(t *testing.T) {
	require.Nil(t, chunkText("  ", 10))
	require.Equal(t, []string{"short"}, chunkText("short", 10))
	parts := chunkText("abcdefghi", 3)
	require.Equal(t, []string{"abc", "def", "ghi"}, parts)
}

func TestWithRetrySucceeds(t *testing.T) {
	n := 0
	err := withRetry(t.Context(), func() error {
		n++
		if n < 2 {
			return assertErr("transient")
		}
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, 2, n)
}

func TestWithRetryStopsOnPermanentError(t *testing.T) {
	n := 0
	err := withRetry(t.Context(), func() error {
		n++
		return &httpStatusError{StatusCode: http.StatusForbidden, Body: "app revoked"}
	})
	require.Error(t, err)
	require.Equal(t, 1, n)
	require.True(t, isPermanentError(err))
}

func TestWithRetryTreatsRateLimitAsTransient(t *testing.T) {
	n := 0
	err := withRetry(t.Context(), func() error {
		n++
		return &httpStatusError{StatusCode: http.StatusTooManyRequests}
	})
	require.Error(t, err)
	require.Equal(t, egressMaxAttempts, n)
	require.False(t, isPermanentError(err))
}

func TestWithRetryAbortsOnCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	n := 0
	err := withRetry(ctx, func() error {
		n++
		return assertErr("transient")
	})
	require.Error(t, err)
	require.Equal(t, 1, n)
}

func TestFeishuVerifyRejectsTokenlessEvent(t *testing.T) {
	p := &FeishuProvider{}
	cfg, _ := json.Marshal(feishuBridgeConfig{AppID: "a", AppSecret: "b", VerificationToken: "tok-v2"})

	event := []byte(`{"header":{"event_type":"im.message.receive_v1"},"event":{"message":{"content":"hi"}}}`)
	require.Error(t, p.VerifyWebhook(t.Context(), cfg, http.Header{}, event))

	handshake := []byte(`{"type":"url_verification","challenge":"abc"}`)
	require.NoError(t, p.VerifyWebhook(t.Context(), cfg, http.Header{}, handshake))
}

func TestWeComSendRequestAddressesGroupsByChatID(t *testing.T) {
	cfg := weComBridgeConfig{AgentID: 42}

	endpoint, payload := wecomSendRequest(cfg, OutboundMessage{
		ExternalThreadID: "chat-1", PeerKind: domain.PeerGroup, Text: "hi",
	})
	require.Contains(t, endpoint, "appchat/send")
	require.Equal(t, "chat-1", payload["chatid"])
	require.NotContains(t, payload, "touser")

	endpoint, payload = wecomSendRequest(cfg, OutboundMessage{
		ExternalThreadID: "user-1", PeerKind: domain.PeerDirect, Text: "hi",
	})
	require.Contains(t, endpoint, "message/send")
	require.Equal(t, "user-1", payload["touser"])
	require.Equal(t, int64(42), payload["agentid"])
}

func TestChunkTextKeepsNewlineCutInRuneUnits(t *testing.T) {
	text := "中文第一行内容\n中文第二行内容需要更长一些以便触发切分"
	parts := chunkText(text, 12)
	require.Greater(t, len(parts), 1)
	require.Equal(t, "中文第一行内容", parts[0])
}

type assertErr string

func (e assertErr) Error() string { return string(e) }

func TestProgressText(t *testing.T) {
	require.Equal(t, "⏳ Working…", progressText(nil))
	require.Equal(t, "⏳ Working on @coder…", progressText(&routeResolution{TargetRef: "coder"}))
}

