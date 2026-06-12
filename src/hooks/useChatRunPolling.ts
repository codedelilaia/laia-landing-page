import { useEffect, useMemo, useState } from 'react';
import { fetchRunStatus } from '../api/chat';
import type { ChatRunStatusResponse } from '../types/dashboard';

export function useChatRunPolling(runIds: string[], initialStatuses: Record<string, ChatRunStatusResponse> = {}) {
  const [statuses, setStatuses] = useState<Record<string, ChatRunStatusResponse>>(initialStatuses);
  const key = useMemo(() => runIds.sort().join(':'), [runIds]);

  useEffect(() => {
    if (!runIds.length) return;
    let cancelled = false;
    let timer: number | undefined;
    let interval = 1500;

    const poll = async () => {
      const updates = await Promise.all(runIds.map(async (runId) => [runId, await fetchRunStatus(runId)] as const));
      if (cancelled) return;
      setStatuses((current) => ({ ...current, ...Object.fromEntries(updates) }));
      const hasPending = updates.some(([, update]) => update.run.status === 'queued' || update.run.status === 'running');
      if (hasPending) {
        interval = interval >= 30_000 ? 10_000 : Math.min(10_000, interval + 500);
        timer = window.setTimeout(poll, interval);
      }
    };

    timer = window.setTimeout(poll, 300);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [key]);

  return statuses;
}
