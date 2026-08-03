package agentsession

import (
	"context"
	"errors"
	"time"

	poddomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentpod"
	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/agentsession"
)

// Runner events (workbench batches, pod status) can reach the backend before any
// client asked for a session, and dropping them would lose the capabilities and
// terminal resource a pod only publishes once at startup.
func (s *Service) EnsureForPod(
	ctx context.Context,
	pod *poddomain.Pod,
) (*domain.Session, error) {
	if pod == nil || pod.PodKey == "" {
		return nil, ErrNotFound
	}
	existing, err := s.GetByPodKey(ctx, pod.PodKey)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	id, err := NewID()
	if err != nil {
		return nil, err
	}
	title := pod.Alias
	if title == nil {
		title = pod.Title
	}
	now := time.Now()
	row := &domain.Session{
		ID:             id,
		OrganizationID: pod.OrganizationID,
		UserID:         pod.CreatedByID,
		PodKey:         pod.PodKey,
		AgentSlug:      pod.AgentSlug,
		Title:          title,
		Status:         "idle",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.Create(ctx, row); err == nil {
		return row, nil
	}
	return s.GetByPodKey(ctx, pod.PodKey)
}
