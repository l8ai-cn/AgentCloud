package imbridge

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	domain "github.com/l8ai-cn/agentcloud/backend/internal/domain/imbridge"
)

func (b *Bridge) StartMonitor(ctx context.Context) {
	go b.runWeixinMonitor(ctx)
}

func (b *Bridge) runWeixinMonitor(ctx context.Context) {
	var (
		mu      sync.Mutex
		workers = map[int64]context.CancelFunc{}
	)
	reconcile := func() {
		conns, err := b.listActiveWeixinConnections(ctx)
		if err != nil {
			slog.WarnContext(ctx, "weixin monitor list failed", "error", err)
			return
		}
		active := make(map[int64]*domain.Connection, len(conns))
		for _, conn := range conns {
			active[conn.ID] = conn
		}
		mu.Lock()
		defer mu.Unlock()
		for id, cancel := range workers {
			if _, ok := active[id]; !ok {
				cancel()
				delete(workers, id)
			}
		}
		for id, conn := range active {
			if _, ok := workers[id]; ok {
				continue
			}
			workerCtx, cancel := context.WithCancel(ctx)
			workers[id] = cancel
			go b.pollWeixinConnectionLoop(workerCtx, conn.ID)
		}
	}
	reconcile()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			mu.Lock()
			for id, cancel := range workers {
				cancel()
				delete(workers, id)
			}
			mu.Unlock()
			return
		case <-ticker.C:
			reconcile()
		}
	}
}

func (b *Bridge) listActiveWeixinConnections(ctx context.Context) ([]*domain.Connection, error) {
	conns, err := b.repo.ListActiveByProvider(ctx, domain.ProviderWeixin)
	if err != nil {
		return nil, err
	}
	wechatConns, err := b.repo.ListActiveByProvider(ctx, domain.ProviderWeChat)
	if err == nil {
		conns = append(conns, wechatConns...)
	}
	return conns, nil
}

func (b *Bridge) pollWeixinConnectionLoop(ctx context.Context, connectionID int64) {
	backoff := time.Second
	for {
		if ctx.Err() != nil {
			return
		}
		conn, err := b.reloadWeixinConnection(ctx, connectionID)
		if err != nil || conn == nil || conn.Status != domain.StatusActive {
			return
		}
		if err := b.pollWeixinConnection(ctx, conn); err != nil {
			slog.WarnContext(ctx, "weixin poll failed", "connection_id", connectionID, "error", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			if backoff < 30*time.Second {
				backoff *= 2
			}
			continue
		}
		backoff = time.Second
	}
}

func (b *Bridge) reloadWeixinConnection(ctx context.Context, connectionID int64) (*domain.Connection, error) {
	conns, err := b.listActiveWeixinConnections(ctx)
	if err != nil {
		return nil, err
	}
	for _, conn := range conns {
		if conn.ID == connectionID {
			return conn, nil
		}
	}
	return nil, nil
}

func (b *Bridge) pollWeixinConnection(ctx context.Context, conn *domain.Connection) error {
	raw, err := b.providerConfig(conn)
	if err != nil {
		return err
	}
	cfg, err := parseWeixinConfig(raw)
	if err != nil {
		return err
	}
	if strings.TrimSpace(cfg.BotToken) == "" {
		return nil
	}
	p, err := GetProvider(b.registry, domain.ProviderWeixin)
	if err != nil {
		return err
	}
	wp, ok := p.(*WeixinProvider)
	if !ok {
		return fmt.Errorf("weixin provider unavailable")
	}
	updates, err := wp.ilink().getUpdates(ctx, cfg)
	if err != nil {
		b.markError(ctx, conn, err.Error())
		return err
	}
	if updates.ErrCode == -14 {
		b.markError(ctx, conn, "weixin session expired, please re-login")
		return fmt.Errorf("weixin session expired")
	}
	if updates.GetUpdatesBuf != "" && updates.GetUpdatesBuf != cfg.GetUpdatesBuf {
		if err := b.persistWeixinConfig(ctx, conn, weixinBridgeConfig{GetUpdatesBuf: updates.GetUpdatesBuf}); err != nil {
			return err
		}
	}
	for _, msg := range updates.Messages {
		event := parseWeixinInbound(msg)
		if event == nil {
			continue
		}
		if err := b.DeliverInbound(ctx, conn, event); err != nil {
			b.markError(ctx, conn, err.Error())
		}
	}
	return nil
}
