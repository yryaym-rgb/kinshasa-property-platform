import { useEffect, useState } from 'react';
import { getLockState, subscribeRateLimit, type LockState, type RateLimitKey } from '@/lib/authRateLimit';

/** Live view of a rate-limit bucket; ticks every second while locked so countdowns stay accurate. */
export function useLockout(key: RateLimitKey): LockState {
  const [state, setState] = useState<LockState>(() => getLockState(key));

  useEffect(() => {
    const update = () => setState(getLockState(key));
    update();
    const unsubscribe = subscribeRateLimit(update);
    const interval = state.locked ? window.setInterval(update, 1000) : undefined;
    return () => {
      unsubscribe();
      if (interval) window.clearInterval(interval);
    };
  }, [key, state.locked]);

  return state;
}

/** Simple one-second countdown starting at `seconds`; `restart()` rewinds it. */
export function useCountdown(seconds: number, autoStart = true) {
  const [remaining, setRemaining] = useState(autoStart ? seconds : 0);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  return { remaining, restart: () => setRemaining(seconds), done: remaining <= 0 };
}
