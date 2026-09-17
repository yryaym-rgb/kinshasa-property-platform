/**
 * Landlord + DGI tax hooks on top of `taxService`.
 *
 * Landlord hooks are keyed by bailleur id and refresh live: an `impots` UPDATE
 * (pipeline, recalculation, DGI marking as paid) invalidates the relevant
 * queries through Supabase Realtime (`impots` is in the realtime publication —
 * migration 010).
 */

import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { useBailleurId } from '@/hooks/useProperties';
import { useSupabaseMutation } from '@/hooks/useSupabaseMutation';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { taxService } from '@/services/tax/taxService';
import type { AnomalyFilters, AnomalyStatus, RevenueFilters, TaxRecalculateRequest, TypeContribuable } from '@/types/tax';

export { useBailleurId };

export const TAX_QUERY_KEYS = {
  summary: (bailleurId?: string, period?: string) => ['tax-summary', bailleurId, period ?? 'all'] as const,
  compliance: (bailleurId?: string) => ['tax-compliance', bailleurId] as const,
  deadlines: (bailleurId?: string) => ['tax-deadlines', bailleurId] as const,
  history: (bailleurId?: string, filters?: unknown) => ['tax-history', bailleurId, filters] as const,
  detail: (impotId?: string) => ['tax-detail', impotId] as const,
  rules: () => ['tax-rules'] as const,
  fiscalDashboard: (filters: RevenueFilters) => ['fiscal-dashboard', filters.from, filters.to] as const,
  anomalies: (filters?: AnomalyFilters) => ['fiscal-anomalies', filters] as const,
  forecast: (months: number) => ['fiscal-forecast', months] as const,
  monthlySeries: (months: number) => ['fiscal-monthly-series', months] as const,
};

/** Invalidate landlord tax queries when any of the landlord's impôts change. */
export function useTaxRealtime(bailleurId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!bailleurId) return;
    const channel = supabase
      .channel(`impots:${bailleurId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'impots', filter: `bailleur_id=eq.${bailleurId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['tax-summary', bailleurId] });
        void queryClient.invalidateQueries({ queryKey: ['tax-compliance', bailleurId] });
        void queryClient.invalidateQueries({ queryKey: ['tax-deadlines', bailleurId] });
        void queryClient.invalidateQueries({ queryKey: ['tax-history', bailleurId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bailleurId, queryClient]);
}

// ─── Landlord ─────────────────────────────────────────────────────────────

export function useTaxSummary(period?: string, bailleurIdOverride?: string) {
  const own = useBailleurId();
  const bailleurId = bailleurIdOverride ?? own;
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.summary(bailleurId, period),
    queryFn: () => taxService.getTaxSummary(bailleurId!, period),
    enabled: !!bailleurId,
    staleTime: 60_000,
  });
}

export function useUpcomingDeadlines(bailleurIdOverride?: string) {
  const own = useBailleurId();
  const bailleurId = bailleurIdOverride ?? own;
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.deadlines(bailleurId),
    queryFn: () => taxService.getUpcomingDeadlines(bailleurId!),
    enabled: !!bailleurId,
    staleTime: 60_000,
  });
}

export function useTaxHistory(filters?: { year?: number | 'all'; status?: string }, bailleurIdOverride?: string) {
  const own = useBailleurId();
  const bailleurId = bailleurIdOverride ?? own;
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.history(bailleurId, filters),
    queryFn: () => taxService.getTaxHistory(bailleurId!, filters),
    enabled: !!bailleurId,
    staleTime: 60_000,
  });
}

export function useTaxDetail(impotId: string | undefined) {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.detail(impotId),
    queryFn: () => taxService.getTaxDetail(impotId!),
    enabled: !!impotId,
  });
}

export function useTaxRules() {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.rules(),
    queryFn: () => taxService.getActiveRules(),
    staleTime: 5 * 60_000,
  });
}

/** What-if simulator (mutation: every run is audited as a simulation). */
export function useTaxSimulation() {
  const bailleurId = useBailleurId();
  return useSupabaseMutation({
    mutationFn: (input: { montantBrut: number; typeLogement: string; commune: string; typeContribuable?: TypeContribuable }) =>
      taxService.simulate({ ...input, bailleurId: bailleurId ?? null }),
    errorMessage: 'La simulation a échoué. Réessayez.',
  });
}

// ─── DGI ──────────────────────────────────────────────────────────────────

export function useFiscalDashboard(filters: RevenueFilters) {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.fiscalDashboard(filters),
    queryFn: () => taxService.getAggregateRevenue(filters),
    staleTime: 2 * 60_000,
  });
}

export function useAnomalies(filters?: AnomalyFilters) {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.anomalies(filters),
    queryFn: () => taxService.getAnomalies(filters),
    staleTime: 60_000,
  });
}

export function useAnomalyActions() {
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['fiscal-anomalies'] });
    void queryClient.invalidateQueries({ queryKey: ['fiscal-dashboard'] });
  }, [queryClient]);

  const updateStatus = useSupabaseMutation({
    mutationFn: ({ id, statut, commentaire }: { id: string; statut: AnomalyStatus; commentaire?: string }) => taxService.updateAnomalyStatus(id, statut, commentaire),
    successMessage: 'Anomalie mise à jour',
    onSuccess: invalidate,
  });

  const detect = useSupabaseMutation({
    mutationFn: () => taxService.runAnomalyDetection(),
    onSuccess: invalidate,
    errorMessage: 'La détection a échoué',
  });

  return { updateStatus, detect };
}

export function useForecast(months = 12) {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.forecast(months),
    queryFn: () => taxService.getForecast(months),
    staleTime: 5 * 60_000,
  });
}

export function useMonthlySeries(months = 24) {
  return useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.monthlySeries(months),
    queryFn: () => taxService.getMonthlySeries(months),
    staleTime: 5 * 60_000,
  });
}

export function useTaxRecalculation() {
  const queryClient = useQueryClient();
  return useSupabaseMutation({
    mutationFn: (params: TaxRecalculateRequest) => taxService.recalculate(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['fiscal-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['tax-summary'] });
    },
    errorMessage: 'Le recalcul a échoué',
  });
}
