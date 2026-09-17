/**
 * Compliance score (0-100) with its four components, refreshed live when the
 * landlord's impôts or payments change (the post-success pipeline runs
 * `check_compliance_score` and updates `bailleurs`).
 */

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { useBailleurId } from '@/hooks/useProperties';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { taxService } from '@/services/tax/taxService';
import { COMPLIANCE_COLORS, complianceLevelFromScore, type ComplianceLevel, type ComplianceScore } from '@/types/tax';
import { TAX_QUERY_KEYS } from './useTaxes';

export interface ComplianceAdvice {
  key: ComplianceScore['components'][number]['key'];
  label: string;
  message: string;
  /** Points that can still be earned on this component. */
  potential: number;
}

const ADVICE: Record<ComplianceAdvice['key'], string> = {
  kyc: 'Faites vérifier votre identité (KYC) pour sécuriser votre compte et gagner jusqu’à 25 points.',
  payments: 'Encouragez vos locataires à payer avant le 15 du mois suivant : chaque loyer ponctuel améliore votre score.',
  taxes: 'Déclarez et réglez vos impôts calculés avant l’échéance pour atteindre le maximum sur ce critère.',
  properties: 'Enregistrez au moins un bien pour activer ce critère.',
};

export function useTaxCompliance(bailleurIdOverride?: string) {
  const own = useBailleurId();
  const bailleurId = bailleurIdOverride ?? own;
  const queryClient = useQueryClient();

  const query = useSupabaseQuery({
    queryKey: TAX_QUERY_KEYS.compliance(bailleurId),
    queryFn: () => taxService.getComplianceScore(bailleurId!),
    enabled: !!bailleurId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!bailleurId) return;
    const channel = supabase
      .channel(`compliance:${bailleurId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bailleurs', filter: `id=eq.${bailleurId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: TAX_QUERY_KEYS.compliance(bailleurId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bailleurId, queryClient]);

  const derived = useMemo(() => {
    const data = query.data;
    if (!data) return null;
    const level: ComplianceLevel = data.level ?? complianceLevelFromScore(data.score);
    const advice: ComplianceAdvice[] = data.components
      .map((c) => ({ key: c.key, label: c.label, message: ADVICE[c.key], potential: Math.max(0, c.max - c.score) }))
      .filter((a) => a.potential > 0.5)
      .sort((a, b) => b.potential - a.potential);
    return { level, colors: COMPLIANCE_COLORS[level], advice };
  }, [query.data]);

  return { ...query, level: derived?.level ?? null, colors: derived?.colors ?? null, advice: derived?.advice ?? [] };
}
