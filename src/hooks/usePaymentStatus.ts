/**
 * usePaymentStatus — realtime + polling hybrid for one payment.
 *
 *  Primary   Supabase Realtime `UPDATE` on `paiements` (row filter by id).
 *  Fallback  `payment-verify` every 5 s while the payment is in flight
 *            (the server rate-limits and decides whether to hit the operator).
 *  Timeout   After 60 s without a terminal state the hook reports `expired`
 *            locally (source = 'timeout'); a late webhook can still upgrade it
 *            server-side (`expired → succeeded` is a legal transition).
 *  Cleanup   Channel + timers removed on unmount or terminal state.
 *
 * The snapshot exposes the pipeline checkpoints so the success screen can show
 * "reçu en cours de génération" without a second round-trip.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/config/supabase';
import { paymentService } from '@/services/payment/paymentService';
import { isInFlight, isPaymentState, isTerminal, type PaymentState } from '@/services/payment/stateMachine';
import type { PaymentRecord, PaymentStatusSnapshot, PipelineStatus, VerifyPaymentResponse } from '@/types/payment';
import { PaymentError } from '@/utils/paymentErrors';

export interface UsePaymentStatusOptions {
  /** Poll interval while in flight (default 5000 ms). */
  pollIntervalMs?: number;
  /** Local timeout after which the payment is considered expired (default 60 000 ms). */
  timeoutMs?: number;
  enabled?: boolean;
  onTerminal?: (snapshot: PaymentStatusSnapshot) => void;
}

export interface UsePaymentStatusResult {
  snapshot: PaymentStatusSnapshot | null;
  state: PaymentState | null;
  isLoading: boolean;
  isTerminal: boolean;
  isSuccess: boolean;
  isFailure: boolean;
  error: PaymentError | null;
  /** Realtime channel is connected. */
  realtimeConnected: boolean;
  /** Seconds elapsed since the hook started watching. */
  elapsedSeconds: number;
  /** Force a verify round-trip now (ignores the local poll schedule). */
  refresh: () => Promise<void>;
  /** USER_CANCELLED through the state machine. */
  cancel: (reason?: string) => Promise<void>;
}

const DEFAULT_POLL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 60_000;

function fromVerify(v: VerifyPaymentResponse, source: PaymentStatusSnapshot['source']): PaymentStatusSnapshot {
  return {
    paymentId: v.paymentId,
    state: v.state,
    failureReason: v.failureReason,
    providerTransactionId: v.providerTransactionId,
    paidAt: v.paidAt,
    receiptId: v.receiptId,
    receiptCode: v.receiptCode,
    impotId: v.impotId,
    pipeline: v.pipeline ?? {},
    source,
    updatedAt: new Date().toISOString(),
  };
}

function fromRecord(row: PaymentRecord, source: PaymentStatusSnapshot['source']): PaymentStatusSnapshot {
  const pipeline = (row.pipeline ?? {}) as PipelineStatus;
  return {
    paymentId: row.id,
    state: row.state,
    failureReason: row.failure_reason,
    providerTransactionId: row.provider_transaction_id,
    paidAt: row.paid_at,
    receiptId: (pipeline.receipt?.result?.receiptId as string | undefined) ?? null,
    receiptCode: (pipeline.receipt?.result?.receiptCode as string | undefined) ?? null,
    impotId: (pipeline.tax?.result?.impotId as string | undefined) ?? null,
    pipeline,
    source,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export function usePaymentStatus(paymentId: string | null | undefined, options: UsePaymentStatusOptions = {}): UsePaymentStatusResult {
  const { pollIntervalMs = DEFAULT_POLL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, enabled = true, onTerminal } = options;

  const [snapshot, setSnapshot] = useState<PaymentStatusSnapshot | null>(null);
  const [error, setError] = useState<PaymentError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(paymentId) && enabled);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startedAtRef = useRef<number>(0);
  const terminalNotifiedRef = useRef(false);
  const onTerminalRef = useRef(onTerminal);
  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);
  const inFlightVerifyRef = useRef<Promise<void> | null>(null);
  const snapshotRef = useRef<PaymentStatusSnapshot | null>(null);

  const apply = useCallback((next: PaymentStatusSnapshot) => {
    const prev = snapshotRef.current;
    // Never regress from a terminal state on a stale poll response — except
    // the legal upgrade expired → succeeded.
    if (prev && isTerminal(prev.state) && !isTerminal(next.state)) return;
    if (prev && prev.state === 'succeeded' && next.state !== 'succeeded' && next.state !== 'refunded' && next.state !== 'disputed') return;
    snapshotRef.current = next;
    setSnapshot(next);
    setIsLoading(false);
    if (isTerminal(next.state) && !terminalNotifiedRef.current) {
      terminalNotifiedRef.current = true;
      onTerminalRef.current?.(next);
    }
  }, []);

  const verify = useCallback(
    async (force = false) => {
      if (!paymentId) return;
      if (inFlightVerifyRef.current) return inFlightVerifyRef.current;
      const run = (async () => {
        try {
          const v = await paymentService.verifyPayment(paymentId, { force });
          apply(fromVerify(v, 'poll'));
          setError(null);
        } catch (e) {
          const err = e instanceof PaymentError ? e : new PaymentError('unknown', { details: String(e) });
          // Not-found is fatal; transient errors just wait for the next tick.
          if (err.code === 'payment_not_found' || err.code === 'forbidden' || err.code === 'unauthorized') {
            setError(err);
            setIsLoading(false);
          } else {
            setError(err);
          }
        } finally {
          inFlightVerifyRef.current = null;
        }
      })();
      inFlightVerifyRef.current = run;
      return run;
    },
    [paymentId, apply],
  );

  // Reset when the payment id changes.
  useEffect(() => {
    snapshotRef.current = null;
    setSnapshot(null);
    setError(null);
    setIsLoading(Boolean(paymentId) && enabled);
    setElapsedSeconds(0);
    startedAtRef.current = Date.now();
    terminalNotifiedRef.current = false;
  }, [paymentId, enabled]);

  // Initial fetch, realtime subscription, polling, timeout.
  useEffect(() => {
    if (!paymentId || !enabled) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const stopWatching = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (tickTimer) clearInterval(tickTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      pollTimer = tickTimer = timeoutTimer = null;
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
        setRealtimeConnected(false);
      }
    };

    // 1. Initial state straight from the DB (RLS) — cheap, then verify.
    void (async () => {
      try {
        const row = await paymentService.getPaymentById(paymentId);
        if (cancelled) return;
        if (isPaymentState(row.state)) apply(fromRecord(row, 'initial'));
        if (isPaymentState(row.state) && isInFlight(row.state)) void verify();
        else if (row.state === 'succeeded' && !snapshotRef.current?.receiptId) void verify();
      } catch {
        if (cancelled) return;
        // Fall back to verify (the Edge Function has broader access than RLS).
        await verify();
      }
    })();

    // 2. Realtime — primary channel.
    channel = supabase
      .channel(`payment-status:${paymentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'paiements', filter: `id=eq.${paymentId}` }, (payload) => {
        const row = payload.new as PaymentRecord;
        if (!row || !isPaymentState(row.state)) return;
        apply(fromRecord(row, 'realtime'));
        // Terminal via realtime: one verify to fetch receipt/pipeline details.
        if (isTerminal(row.state)) void verify();
      })
      .subscribe((status) => {
        if (cancelled) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    // 3. Polling fallback — only while in flight.
    pollTimer = setInterval(() => {
      const current = snapshotRef.current;
      if (current && isTerminal(current.state)) {
        stopWatching();
        return;
      }
      void verify();
    }, pollIntervalMs);

    tickTimer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    // 4. Local timeout.
    timeoutTimer = setTimeout(() => {
      const current = snapshotRef.current;
      if (current && isTerminal(current.state)) return;
      apply({
        paymentId,
        state: 'expired',
        failureReason: 'provider_timeout',
        providerTransactionId: current?.providerTransactionId ?? null,
        paidAt: null,
        receiptId: null,
        receiptCode: null,
        impotId: null,
        pipeline: current?.pipeline ?? {},
        source: 'timeout',
        updatedAt: new Date().toISOString(),
      });
      stopWatching();
    }, timeoutMs);

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [paymentId, enabled, pollIntervalMs, timeoutMs, apply, verify]);

  const cancel = useCallback(
    async (reason?: string) => {
      if (!paymentId) return;
      const row = await paymentService.cancelPayment(paymentId, reason);
      apply(fromRecord(row, 'poll'));
    },
    [paymentId, apply],
  );

  const state = snapshot?.state ?? null;
  return {
    snapshot,
    state,
    isLoading,
    isTerminal: state !== null && isTerminal(state),
    isSuccess: state === 'succeeded',
    isFailure: state !== null && (state === 'failed' || state === 'cancelled' || state === 'expired'),
    error,
    realtimeConnected,
    elapsedSeconds,
    refresh: () => verify(true),
    cancel,
  };
}
