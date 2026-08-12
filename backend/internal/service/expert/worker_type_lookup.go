package expert

import (
	"context"
	"errors"
	"fmt"

	specservice "github.com/l8ai-cn/agentcloud/backend/internal/service/workerspec"
)

type WorkerTypeLookup interface {
	AssertWorkerTypeAvailable(context.Context, string) error
}

type WorkerTypeEntitlementGate interface {
	AssertWorkerTypeEntitled(context.Context, int64, int64, string) error
}

func (s *Service) requireWorkerType(ctx context.Context, orgID, userID int64, slug string) error {
	lookup := s.workerTypeLookup()
	if lookup == nil {
		return nil
	}
	if err := lookup.AssertWorkerTypeAvailable(ctx, slug); err != nil {
		if errors.Is(err, specservice.ErrResolverUnavailable) {
			return err
		}
		return fmt.Errorf("%w: %v", ErrExpertWorkerTypeUnavailable, err)
	}
	gate, ok := s.workerTypeLookup().(WorkerTypeEntitlementGate)
	if !ok || gate == nil {
		return nil
	}
	if err := gate.AssertWorkerTypeEntitled(ctx, orgID, userID, slug); err != nil {
		if errors.Is(err, specservice.ErrResolverUnavailable) {
			return err
		}
		return fmt.Errorf("%w: %v", ErrExpertWorkerTypeUnavailable, err)
	}
	return nil
}

func (s *Service) workerTypeLookup() WorkerTypeLookup {
	if s == nil {
		return nil
	}
	if s.workerTypes != nil {
		return s.workerTypes
	}
	if lookup, ok := s.marketWorkerSpecs.(WorkerTypeLookup); ok {
		return lookup
	}
	return nil
}
