import { useChatRunPolling } from './useChatRunPolling';

export function useRunEvents(runIds: string[]) {
  return useChatRunPolling(runIds);
}
