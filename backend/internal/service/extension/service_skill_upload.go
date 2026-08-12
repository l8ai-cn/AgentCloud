package extension

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"path"
	"time"

	"github.com/google/uuid"
	"github.com/l8ai-cn/agentcloud/backend/internal/domain/extension"
)

type PresignSkillUploadResponse struct {
	PutURL     string
	StorageKey string
	Filename   string
}

const presignedSkillUploadExpiry = 15 * time.Minute

const maxSkillUploadBytes = 50 * 1024 * 1024

func (s *Service) PresignSkillUpload(ctx context.Context, orgID, repoID, userID int64, filename, contentType string, size int64) (*PresignSkillUploadResponse, error) {
	if err := s.requireRepositoryAccess(ctx, orgID, repoID, userID); err != nil {
		return nil, err
	}
	if s.storage == nil {
		return nil, fmt.Errorf("%w: storage not configured", ErrInvalidInput)
	}
	if size <= 0 {
		return nil, fmt.Errorf("%w: size must be > 0", ErrInvalidInput)
	}
	if size > maxSkillUploadBytes {
		return nil, fmt.Errorf("%w: upload exceeds maximum size of %d bytes", ErrInvalidInput, maxSkillUploadBytes)
	}
	if filename == "" {
		return nil, fmt.Errorf("%w: filename required", ErrInvalidInput)
	}

	storageKey := newSkillUploadKey(orgID, userID, filename)
	putURL, err := s.storage.PresignPutURL(ctx, storageKey, contentType, presignedSkillUploadExpiry)
	if err != nil {
		return nil, fmt.Errorf("failed to presign upload: %w", err)
	}

	slog.InfoContext(ctx, "skill upload presigned",
		"org_id", orgID, "repo_id", repoID, "user_id", userID,
		"storage_key", storageKey, "size", size)

	return &PresignSkillUploadResponse{
		PutURL:     putURL,
		StorageKey: storageKey,
		Filename:   filename,
	}, nil
}

func (s *Service) InstallSkillFromUploadedKey(ctx context.Context, orgID, repoID, userID int64, storageKey, filename, scope string) (*extension.InstalledSkill, error) {
	if err := validateScope(scope); err != nil {
		return nil, err
	}
	if s.storage == nil {
		return nil, fmt.Errorf("%w: storage not configured", ErrInvalidInput)
	}
	if s.packager == nil {
		return nil, fmt.Errorf("skill packager not configured")
	}
	if storageKey == "" {
		return nil, fmt.Errorf("%w: storage_key required", ErrInvalidInput)
	}
	exists, err := s.storage.Exists(ctx, storageKey)
	if err != nil {
		return nil, fmt.Errorf("failed to verify upload: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: uploaded file at storage_key not found", ErrNotFound)
	}

	body, _, err := s.storage.Download(ctx, storageKey)
	if err != nil {
		return nil, fmt.Errorf("failed to download upload: %w", err)
	}
	defer body.Close()
	reader := io.LimitReader(body, maxSkillUploadBytes+1)

	skill, installErr := s.packager.CompleteUploadInstall(ctx, orgID, repoID, userID, reader, filename, scope)
	if delErr := s.storage.Delete(ctx, storageKey); delErr != nil {
		slog.WarnContext(ctx, "failed to delete skill upload staging blob",
			"storage_key", storageKey, "error", delErr)
	}
	if installErr != nil {
		return nil, installErr
	}
	return skill, nil
}

func newSkillUploadKey(orgID, userID int64, filename string) string {
	ext := path.Ext(filename)
	if ext == "" {
		ext = ".tar.gz"
	}
	return fmt.Sprintf("skill-uploads/%d/%d/%s%s", orgID, userID, uuid.New().String(), ext)
}
