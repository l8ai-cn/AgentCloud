"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { usePod, usePodStore } from "@/stores/pod";
import { ApiError } from "@/lib/api/api-types";
import { derivePodLiveness, type PodLiveness } from "@/lib/pod-liveness";

interface FetchError {
  podKey: string;
  message: string;
}

const MAX_FETCH_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 1000;

export function usePodStatus(podKey: string): PodLiveness {
  const initialFetchDone = useRef(false);
  const retryCount = useRef(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const [fetchError, setFetchError] = useState<FetchError | null>(null);

  const storePod = usePod(podKey);
  const fetchPod = usePodStore((state) => state.fetchPod);

  const { podStatus, isPodReady, podError } = useMemo(() => {
    if (!storePod?.status && fetchError?.podKey === podKey) {
      return { podStatus: "error", isPodReady: false, podError: fetchError.message };
    }
    return derivePodLiveness(storePod);
  }, [storePod, fetchError, podKey]);

  useEffect(() => {
    initialFetchDone.current = false;
    retryCount.current = 0;
  }, [podKey]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    if (initialFetchDone.current || storePod) return;
    if (retryCount.current >= MAX_FETCH_ATTEMPTS) return;

    retryCount.current++;
    fetchPod(podKey)
      .then(() => {
        if (!cancelled) initialFetchDone.current = true;
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          initialFetchDone.current = true;
          setFetchError({ podKey, message: "Pod not found" });
        } else if (retryCount.current >= MAX_FETCH_ATTEMPTS) {
          setFetchError({ podKey, message: "Failed to load pod" });
        } else {
          retryTimer = setTimeout(() => setRetryVersion((version) => version + 1), FETCH_RETRY_DELAY_MS);
        }
      });
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [podKey, fetchPod, storePod, retryVersion]);

  return { podStatus, isPodReady, podError };
}
