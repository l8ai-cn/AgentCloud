import type { KnowledgeMountSelection } from "@/lib/api/facade/knowledgeBaseApi";

export function sameKnowledgeMount(
  left: KnowledgeMountSelection,
  right: KnowledgeMountSelection,
): boolean {
  if (left.id && right.id) return left.id === right.id;
  return left.slug !== "" && left.slug === right.slug;
}

export function mountSlug(
  mount: KnowledgeMountSelection,
  knowledgeBases: Array<{ id: number; slug: string }>,
): string {
  return (
    mount.slug ||
    knowledgeBases.find((item) => item.id === mount.id)?.slug ||
    `#${mount.id}`
  );
}

export function isKnowledgeBaseServiceUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /HTTP\s*404|page not found|unimplemented|Code\.NotFound|not_found/i.test(
    message,
  );
}
