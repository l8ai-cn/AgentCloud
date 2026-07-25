import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { WorkerClient } from "../WorkerClient";
import type { WorkerTransport } from "../contracts";

const WorkerClientContext = createContext<WorkerClient | null>(null);

export function WorkerProvider({
  children,
  client,
  transports,
}: {
  children: ReactNode;
  client?: WorkerClient;
  transports?: readonly WorkerTransport[];
}) {
  const value = useMemo(() => {
    if (client) return client;
    const next = new WorkerClient();
    for (const transport of transports ?? []) next.register(transport);
    return next;
  }, [client, transports]);

  return (
    <WorkerClientContext.Provider value={value}>
      {children}
    </WorkerClientContext.Provider>
  );
}

export function useWorkerClient(): WorkerClient {
  const client = useContext(WorkerClientContext);
  if (!client) {
    throw new Error("WorkerProvider is required");
  }
  return client;
}
