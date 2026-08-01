"use client";

import { useParams } from "next/navigation";
import { BookOpen, Code2, Download, KeyRound, Terminal } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getApiBaseUrl } from "@/lib/env";

import { CodeBlock, DocLink, InfoCard } from "./ApiAccessCards";

export default function ApiAccessPage() {
  const params = useParams();
  const orgSlug = String(params.org ?? "dev-org");
  const extBase = `${getApiBaseUrl()}/api/v1/ext/orgs/${orgSlug}`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title="API 接入" subtitle="把已发布的 Expert 作为 API 提供给其他业务系统" />

      <div className="flex-1 overflow-y-auto bg-surface-muted/25">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6 lg:px-8">
          <p className="text-sm leading-6 text-muted-foreground">
            外部系统只能通过 API Key 访问{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">/api/v1/ext</code>{" "}
            下的接口。顺序是：先在控制台创建 Worker 并「发布为 Expert」，再签发 API Key，最后由业务系统调用
            Expert 的 run 接口触发任务、读取产物。全新 Worker 的创建只能在控制台完成，不能通过 API Key 发起。
          </p>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard icon={<Terminal className="h-4 w-4" />} title="Base URL" value={extBase} />
            <InfoCard
              icon={<KeyRound className="h-4 w-4" />}
              title="认证方式"
              value="Authorization: Bearer <API Key>"
            />
            <InfoCard
              icon={<BookOpen className="h-4 w-4" />}
              title="所需 Scope"
              value="experts:write + pods:read"
            />
          </section>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4 text-primary" />
                1. 触发一次任务
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CodeBlock
                code={`curl -X POST "${extBase}/experts/sales-order-excel/run" \\
  -H "Authorization: Bearer $AGENTCLOUD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt_override": "根据附带的订单数据生成销售订单 Excel，输出到 output/sales-order.xlsx",
    "env": { "ORDER_DATE": "2026-08-01" }
  }'

# 201 Created
# { "pod": { "pod_key": "pod_xxx", "status": "starting", ... } }`}
              />
              <p className="text-sm text-muted-foreground">
                <code className="font-mono text-xs">env</code> 只接受 Expert 已声明的变量；未声明的键会被拒绝。
                run 是异步的：返回 pod_key 后用下面的接口轮询状态和产物。
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-primary" />
                2. 取回生成的文件
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CodeBlock
                code={`# 查看运行状态
curl "${extBase}/workers/$POD_KEY" \\
  -H "Authorization: Bearer $AGENTCLOUD_API_KEY"

# 列出工作区文件
curl "${extBase}/workers/$POD_KEY/workspace/files?path=output" \\
  -H "Authorization: Bearer $AGENTCLOUD_API_KEY"

# 读取单个文件（二进制返回 encoding=base64，需要自行解码）
curl "${extBase}/workers/$POD_KEY/workspace/files/output/sales-order.xlsx" \\
  -H "Authorization: Bearer $AGENTCLOUD_API_KEY" \\
  | python3 -c "import sys,json,base64; d=json.load(sys.stdin); \\
open('sales-order.xlsx','wb').write(base64.b64decode(d['content']))"`}
              />
              <p className="text-sm text-muted-foreground">
                工作区文件读取要求 Pod 仍在运行，单文件上限 8MB。需要长期留存产物时，让 Agent 把文件写入
                知识库或对象存储，而不是只留在工作区。
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">3. 复用已有 Worker（可选）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CodeBlock
                code={`curl -X POST "${extBase}/workers" \\
  -H "Authorization: Bearer $AGENTCLOUD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "source_pod_key": "pod_xxx" }'`}
              />
              <p className="text-sm text-muted-foreground">
                该接口只按血缘恢复：必须传{" "}
                <code className="font-mono text-xs">source_pod_key</code>，且不接受模型、仓库、运行时等运行期覆盖。
                不传会返回 409 <code className="font-mono text-xs">WORKER_RESOURCE_APPLY_REQUIRED</code>。
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base">常用入口</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <DocLink href={`/${orgSlug}/experts`}>发布 / 管理 Expert</DocLink>
              <DocLink href={`/${orgSlug}/settings?scope=organization&tab=api-keys`}>
                API Key 管理
              </DocLink>
              <DocLink href="/docs/api">API 总览</DocLink>
              <DocLink href="/docs/api/pods">Worker 生命周期接口</DocLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
