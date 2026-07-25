import type { WorkspaceFileSource } from "../../conversation/mentions/workspaceFileSource";
import { parseWorkspaceFileList } from "../../conversation/mentions/parseWorkspaceFileList";
import { omnigentJson, type OmnigentFetch } from "./omnigentFetch";

const DEFAULT_ENVIRONMENT_ID = "default";

export function createOmnigentWorkspaceFiles(
  request: OmnigentFetch,
  environmentId = DEFAULT_ENVIRONMENT_ID,
): WorkspaceFileSource {
  return {
    async list(sessionId, dir) {
      const base = `/v1/sessions/${encodeURIComponent(sessionId)}/resources/environments/${encodeURIComponent(environmentId)}/filesystem`;
      const path =
        dir === ""
          ? `${base}?limit=1000&order=asc`
          : `${base}/${dir
              .split("/")
              .filter(Boolean)
              .map(encodeURIComponent)
              .join("/")}?limit=1000&order=asc`;
      const body = await omnigentJson<unknown>(await request(path));
      return parseWorkspaceFileList(body);
    },
  };
}
