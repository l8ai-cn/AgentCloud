package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/config"
	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/httpserver"
	"github.com/l8ai-cn/agentcloud/browser-gateway/internal/taskstore"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	store := taskstore.New(cfg.Concurrency, cfg.Driver)
	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           httpserver.New(cfg, store),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("browser-gateway listening",
			"addr", cfg.ListenAddr,
			"driver", cfg.Driver,
			"concurrency", cfg.Concurrency)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}
}
