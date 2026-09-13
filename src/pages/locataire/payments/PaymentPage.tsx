import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailPageSkeleton } from '@/components/common/SkeletonLoaders';
import { Stepper } from '@/components/payments/PaymentWizard/Stepper';
import { PaymentSummary } from '@/components/payments/PaymentSummary';
import { PaymentMethodSelector } from '@/components/payments/PaymentMethodSelector';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContracts } from '@/hooks/useTenantContracts';
import { usePayment } from '@/hooks/usePayment';
import { paymentService } from '@/services/payment/paymentService';
import { formatCDF, normalizePhone } from '@/lib/utils';
import { getCurrentPeriod } from '@/utils/dateUtils';
import { isMobileMoneyProvider } from '@/services/payment/types';
import type { PaymentMethod, PaymentProviderId } from '@/services/payment/types';

const STEP_MAP = { select: 1, amount: 2, method: 3, confirm: 4, processing: 4, success: 4, failed: 4 };

export function PaymentPage() {
  const { user } = useAuth();
  const { data: contracts, isLoading } = useTenantContracts();
  const {
    step,
    setStep,
    payment,
    setPayment,
    initiate,
    processingStatus,
    computeBreakdown,
    generateIdempotencyKey,
  } = usePayment();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const activeContracts = (contracts ?? []).filter((c) => c.status === 'actif');

  useEffect(() => {
    paymentService.getPaymentMethods().then(setMethods);
  }, []);

  useEffect(() => {
    if (!isLoading && activeContracts.length === 1 && step === 'select' && activeContracts[0]) {
      const c = activeContracts[0];
      const rent = Number(c.loyer_mensuel);
      setPayment({
        contratId: c.id,
        rentAmount: rent,
        amount: computeBreakdown(rent).total,
        periode: getCurrentPeriod(),
        phone: user?.phone,
        idempotencyKey: generateIdempotencyKey(),
      });
      setStep('amount');
    }
  }, [isLoading, activeContracts, step, setPayment, setStep, computeBreakdown, user?.phone, generateIdempotencyKey]);

  if (isLoading) return <DetailPageSkeleton />;

  const selectedContract = activeContracts.find((c) => c.id === payment.contratId);
  const stepNumber = STEP_MAP[step];

  const handleSelectContract = (contractId: string) => {
    const c = activeContracts.find((x) => x.id === contractId);
    if (!c) return;
    const rent = Number(c.loyer_mensuel);
    const breakdown = computeBreakdown(rent);
    setPayment({
      contratId: c.id,
      rentAmount: rent,
      amount: breakdown.total,
      periode: getCurrentPeriod(),
      phone: user?.phone,
      idempotencyKey: generateIdempotencyKey(),
    });
    setStep('amount');
  };

  const handleMethodSelect = (method: PaymentProviderId) => {
    const rent = payment.rentAmount ?? 0;
    const breakdown = computeBreakdown(rent, method);
    setPayment({ method, amount: breakdown.total });
  };

  const handleContinueAmount = () => setStep('method');
  const handleContinueMethod = () => {
    if (!payment.method) return;
    const breakdown = computeBreakdown(payment.rentAmount ?? 0, payment.method);
    setPayment({ amount: breakdown.total });
    setStep('confirm');
  };

  if (step === 'processing') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-heading text-3xl font-bold text-[var(--color-kinshasa-blue)]"
        >
          eLoyer
        </motion.div>
        <p className="text-lg font-medium">Traitement en cours...</p>
        <p className="text-sm text-[var(--color-muted-foreground)]">{processingStatus}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Nouveau paiement" subtitle="Payez votre loyer en toute sécurité" />
      <Stepper currentStep={stepNumber} />

      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader><CardTitle>Sélectionner un contrat</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {activeContracts.map((c) => {
                  const logement = c.logement;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectContract(c.id)}
                      className="flex w-full min-h-[64px] items-center justify-between rounded-xl border border-[var(--color-border)] p-4 text-left hover:border-[var(--color-kinshasa-gold)] hover:bg-amber-50/30"
                    >
                      <div>
                        <p className="font-medium">{logement?.type} — {logement?.address}</p>
                        <p className="text-sm text-[var(--color-muted-foreground)]">{formatCDF(Number(c.loyer_mensuel))}/mois</p>
                      </div>
                      <span className="text-[var(--color-kinshasa-blue)]">→</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'amount' && selectedContract && (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Résumé du contrat</CardTitle></CardHeader>
              <CardContent>
                <p className="font-medium">{selectedContract.logement?.type} — {selectedContract.logement?.address}</p>
                <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{selectedContract.logement?.code}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Montant et période</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Période</label>
                  <input
                    type="month"
                    value={payment.periode ?? getCurrentPeriod()}
                    onChange={(e) => setPayment({ periode: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm"
                  />
                </div>
                <PaymentSummary breakdown={computeBreakdown(payment.rentAmount ?? 0, payment.method)} />
                <Button size="lg" className="w-full" onClick={handleContinueAmount}>Continuer</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'method' && (
          <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Choisir le mode de paiement</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <PaymentMethodSelector
                  methods={methods}
                  selected={payment.method ?? null}
                  onSelect={handleMethodSelect}
                />
                {payment.method && isMobileMoneyProvider(payment.method) && (
                  <div>
                    <label htmlFor="phone" className="text-sm font-medium">Numéro Mobile Money</label>
                    <input
                      id="phone"
                      type="tel"
                      value={payment.phone ?? ''}
                      onChange={(e) => setPayment({ phone: normalizePhone(e.target.value) })}
                      placeholder="+243 812 345 678"
                      className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm"
                    />
                  </div>
                )}
                <Button size="lg" className="w-full" disabled={!payment.method} onClick={handleContinueMethod}>
                  Continuer
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Confirmation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <PaymentSummary breakdown={computeBreakdown(payment.rentAmount ?? 0, payment.method)} />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted-foreground)]">Méthode</span>
                    <span>{methods.find((m) => m.id === payment.method)?.name}</span>
                  </div>
                  {payment.phone && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted-foreground)]">Téléphone</span>
                      <span>{payment.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted-foreground)]">Période</span>
                    <span>{payment.periode}</span>
                  </div>
                </div>
                <Button
                  size="xl"
                  className="w-full"
                  onClick={() => initiate()}
                >
                  Confirmer le paiement de {formatCDF(payment.amount ?? 0)}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep('method')}>
                  Annuler
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
