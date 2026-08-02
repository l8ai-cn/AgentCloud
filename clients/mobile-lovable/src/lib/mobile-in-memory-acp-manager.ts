import type { MobileAcpManager } from "./mobile-acp-session";

type SessionMessage = { text: string; role: string; complete?: boolean };
type SessionPermission = {
  id: string;
  tool_name: string;
  args: unknown;
  description: string;
};

type SessionRecord = {
  state: string;
  messages: SessionMessage[];
  pending_permissions: SessionPermission[];
};

export function createInMemoryMobileAcpManager(): MobileAcpManager {
  const sessions = new Map<string, SessionRecord>();

  const ensure = (podKey: string): SessionRecord => {
    const existing = sessions.get(podKey);
    if (existing) return existing;
    const created: SessionRecord = {
      state: "idle",
      messages: [],
      pending_permissions: [],
    };
    sessions.set(podKey, created);
    return created;
  };

  return {
    add_content_chunk(podKey, text, role) {
      ensure(podKey).messages.push({ text, role, complete: false });
    },
    add_log() {},
    add_permission_request(request) {
      const decoded = JSON.parse(new TextDecoder().decode(request)) as {
        podKey?: string;
        requestJson?: string;
      };
      const podKey = typeof decoded.podKey === "string" ? decoded.podKey : "";
      if (!podKey) return;
      const payload = JSON.parse(decoded.requestJson || "{}") as Record<string, unknown>;
      ensure(podKey).pending_permissions.push({
        id: String(payload.id ?? ""),
        tool_name: String(payload.tool_name ?? ""),
        args: payload.args ?? null,
        description: String(payload.description ?? ""),
      });
    },
    clear_session(podKey) {
      sessions.set(podKey, {
        state: "idle",
        messages: [],
        pending_permissions: [],
      });
    },
    get_session_json(podKey) {
      return ensure(podKey);
    },
    mark_last_message_complete(podKey) {
      const session = ensure(podKey);
      const last = session.messages[session.messages.length - 1];
      if (last) last.complete = true;
    },
    update_session_state(podKey, state) {
      ensure(podKey).state = state;
    },
  };
}
