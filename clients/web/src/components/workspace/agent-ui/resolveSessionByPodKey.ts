import { fetchSessionByPodKey } from "@/lib/api/sessionByPodKey";

const LINK_RETRY_DELAY_MS = 500;
const MAX_LINK_ATTEMPTS = 10;

export async function resolveSessionByPodKey(
  podKey: string,
  options: {
    enabled?: boolean;
    fetchSession?: typeof fetchSessionByPodKey;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<string> {
  if (options.enabled === false) {
    throw new Error("Agent session association was not created");
  }
  const fetchSession = options.fetchSession ?? fetchSessionByPodKey;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 1; attempt <= MAX_LINK_ATTEMPTS; attempt += 1) {
    const session = await fetchSession(podKey);
    if (session) return session.id;
    if (attempt >= MAX_LINK_ATTEMPTS) break;
    await sleep(LINK_RETRY_DELAY_MS);
  }
  throw new Error("Agent session association was not created");
}
