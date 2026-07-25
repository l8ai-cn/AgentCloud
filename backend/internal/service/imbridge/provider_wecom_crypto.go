package imbridge

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"fmt"
	"sort"
	"strings"
)

type wecomXMLEnvelope struct {
	XMLName    xml.Name `xml:"xml"`
	ToUserName string   `xml:"ToUserName"`
	Encrypt    string   `xml:"Encrypt"`
	AgentID    string   `xml:"AgentID"`
}

func verifyWeComSignature(token, timestamp, nonce, encrypt, signature string) error {
	items := []string{token, timestamp, nonce, encrypt}
	sort.Strings(items)
	sum := sha1.Sum([]byte(strings.Join(items, "")))
	expected := fmt.Sprintf("%x", sum[:])
	if !strings.EqualFold(expected, signature) {
		return errors.New("wecom signature mismatch")
	}
	return nil
}

func decryptWeComEncrypt(encodingAESKey, encrypt string) (plain string, receiveID string, err error) {
	key, err := base64.StdEncoding.DecodeString(encodingAESKey + "=")
	if err != nil || len(key) != 32 {
		return "", "", errors.New("wecom encoding_aes_key invalid")
	}
	raw, err := base64.StdEncoding.DecodeString(encrypt)
	if err != nil {
		return "", "", fmt.Errorf("wecom encrypt base64: %w", err)
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", err
	}
	if len(raw) < aes.BlockSize || len(raw)%aes.BlockSize != 0 {
		return "", "", errors.New("wecom encrypt payload invalid length")
	}
	iv := key[:aes.BlockSize]
	buf := make([]byte, len(raw))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(buf, raw)
	buf, err = pkcs7Unpad(buf, aes.BlockSize)
	if err != nil {
		return "", "", err
	}
	if len(buf) < 20 {
		return "", "", errors.New("wecom decrypted payload too short")
	}
	msgLen := binary.BigEndian.Uint32(buf[16:20])
	if int(20+msgLen) > len(buf) {
		return "", "", errors.New("wecom decrypted msg length overflow")
	}
	msg := string(buf[20 : 20+msgLen])
	rid := string(buf[20+msgLen:])
	return msg, rid, nil
}

func parseWeComXMLEncrypt(body []byte) (string, error) {
	var env wecomXMLEnvelope
	if err := xml.Unmarshal(body, &env); err != nil {
		return "", err
	}
	if strings.TrimSpace(env.Encrypt) == "" {
		return "", errors.New("wecom xml missing Encrypt")
	}
	return env.Encrypt, nil
}
