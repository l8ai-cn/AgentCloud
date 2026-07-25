import { lightFetch } from "@/lib/light-auth/api-fetch";

interface ExpertFileResponse {
  content: string;
}

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function loadExpertAvatarDataUrl(
  orgSlug: string,
  expertSlug: string,
  repoPath: string,
  signal?: AbortSignal,
): Promise<string> {
  const extension = repoPath.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_MIME_BY_EXTENSION[extension];
  if (!mime) throw new Error(`Unsupported partner avatar extension: ${extension}`);
  const encodedPath = repoPath.split("/").map(encodeURIComponent).join("/");
  const response = await lightFetch<ExpertFileResponse>(
    `/api/v1/orgs/${encodeURIComponent(orgSlug)}/experts/${encodeURIComponent(expertSlug)}/files/${encodedPath}`,
    { authenticated: true, signal },
  );
  if (!response.content) throw new Error("Partner avatar response is empty.");
  return `data:${mime};base64,${response.content}`;
}
