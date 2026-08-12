"use client";

import { RefreshCw } from "lucide-react";

export function RunnerRestartOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal-bg/80 backdrop-blur-sm">
      <div className="text-center p-4">
        <RefreshCw className="w-8 h-8 text-warning mx-auto mb-2 animate-spin" />
        <p className="text-terminal-text font-medium text-sm">Runner is restarting...</p>
        <p className="text-xs text-terminal-text-muted">Session will resume automatically</p>
      </div>
    </div>
  );
}
