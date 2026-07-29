export function EmbeddedSessionNotice({ status }: { status: "error" | "waiting" }) {
  if (status === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在等待嵌入页面建立连接…
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-medium">无法打开嵌入会话</h1>
      <p className="text-sm text-muted-foreground">
        无法打开嵌入会话，请刷新或联系管理员。
      </p>
    </div>
  );
}
