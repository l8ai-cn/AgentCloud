package imbridge

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// Feishu webhook signature: SHA256(timestamp + nonce + encryptKey + rawBody).
func verifyFeishuWebhookSignature(encryptKey string, headers http.Header, rawBody []byte) error {
	encryptKey = strings.TrimSpace(encryptKey)
	if encryptKey == "" {
		return nil
	}
	ts := headers.Get("X-Lark-Request-Timestamp")
	if ts == "" {
		ts = headers.Get("x-lark-request-timestamp")
	}
	nonce := headers.Get("X-Lark-Request-Nonce")
	if nonce == "" {
		nonce = headers.Get("x-lark-request-nonce")
	}
	sig := headers.Get("X-Lark-Signature")
	if sig == "" {
		sig = headers.Get("x-lark-signature")
	}
	if ts == "" || nonce == "" || sig == "" {
		return errors.New("feishu missing signature headers")
	}
	sum := sha256.Sum256([]byte(ts + nonce + encryptKey + string(rawBody)))
	expected := fmt.Sprintf("%x", sum[:])
	if !strings.EqualFold(expected, sig) {
		return errors.New("feishu signature mismatch")
	}
	return nil
}

// decryptFeishuEncryptField implements Lark AESCipher: key=SHA256(encryptKey), AES-256-CBC, base64(iv||cipher).
func decryptFeishuEncryptField(encryptKey, encrypted string) ([]byte, error) {
	encryptKey = strings.TrimSpace(encryptKey)
	encrypted = strings.TrimSpace(encrypted)
	if encryptKey == "" || encrypted == "" {
		return nil, errors.New("feishu encrypt key/payload missing")
	}
	raw, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, fmt.Errorf("feishu encrypt base64: %w", err)
	}
	if len(raw) < aes.BlockSize+1 {
		return nil, errors.New("feishu encrypt payload too short")
	}
	key := sha256.Sum256([]byte(encryptKey))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	iv, ciphertext := raw[:aes.BlockSize], raw[aes.BlockSize:]
	if len(ciphertext)%aes.BlockSize != 0 {
		return nil, errors.New("feishu encrypt ciphertext not block-aligned")
	}
	plain := make([]byte, len(ciphertext))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plain, ciphertext)
	plain, err = pkcs7Unpad(plain, aes.BlockSize)
	if err != nil {
		return nil, err
	}
	return plain, nil
}

func decodeFeishuRequestBody(cfg feishuBridgeConfig, headers http.Header, body []byte) ([]byte, error) {
	if cfg.EncryptKey != "" {
		if err := verifyFeishuWebhookSignature(cfg.EncryptKey, headers, body); err != nil {
			// Signature headers are only present on HTTP webhook; WS/SDK paths skip them.
			if headers.Get("X-Lark-Signature") != "" || headers.Get("x-lark-signature") != "" {
				return nil, err
			}
		}
	}
	var envelope struct {
		Encrypt string `json:"encrypt"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}
	if envelope.Encrypt == "" {
		return body, nil
	}
	if cfg.EncryptKey == "" {
		return nil, errors.New("feishu encrypted payload requires encrypt_key")
	}
	return decryptFeishuEncryptField(cfg.EncryptKey, envelope.Encrypt)
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 || len(data)%blockSize != 0 {
		return nil, errors.New("invalid pkcs7 padding size")
	}
	pad := int(data[len(data)-1])
	if pad == 0 || pad > blockSize || pad > len(data) {
		return nil, errors.New("invalid pkcs7 padding")
	}
	for i := len(data) - pad; i < len(data); i++ {
		if int(data[i]) != pad {
			return nil, errors.New("invalid pkcs7 padding bytes")
		}
	}
	return data[:len(data)-pad], nil
}
