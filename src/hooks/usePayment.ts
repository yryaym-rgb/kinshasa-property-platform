import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService, generateIdempotencyKey as mintIdempotencyKey } from '@/services/payment/paymentService';
import { estimateBreakdown } from '@/services/tax/taxService';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';
import type { PaymentStep, PaymentWizardState, PaymentProviderKey, InitiatePaymentInput, PaymentMethod } from '@/services/payment/types';
import { isMobileMoneyProvider } from '@/services/payment/types';
import { isTerminal } from '@/services/payment/stateMachine';
import { PaymentError } from '@/utils/paymentErrors';

export function usePayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<PaymentStep>('select');
  const [payment, setPayment] = useState<PaymentWizardState>({});
  const [processingStatus, setProcessingStatus] = useState('');
  const [initiateError, setInitiateError] = useState<PaymentError | null>(null);
  const initiatingRef = useRef(false);

  const updatePayment = useCallback((updates: Partial<PaymentWizardState>) => {
    setPayment((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Local ESTIMATE shown before confirmation. The authoritative tax is
   * computed by the fiscal engine once the operator confirms the payment.
   */
  const computeBreakdown = useCallback((rentAmount: number, method?: PaymentProviderKey, methods?: PaymentMethod[]) => {
    const catalogue = methods?.find((m) => m.id === method);
    const paymentMethod = method && isMobileMoneyProvider(method) ? 'mobile_money' : method === 'card' ? 'card' : 'bank';
    const breakdown = estimateBreakdown({
      rentAmount,
      paymentMethod,
      providerFeePercentage: catalogue?.feePercentage,
      providerFeeFixed: catalogue?.feeFixed,
    });
    return { ...breakdown, method: method ?? 'orange_money' };
  }, []);

  const generateIdempotencyKey = useCallback(() => mintIdempotencyKey(payment.contratId ?? 'new'), [payment.contratId]);

  const initiate = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!user?.id || !payment.contratId || !payment.amount || !payment.method) return;

    initiatingRef.current = true;
    setInitiateError(null);
    setStep('processing');
    setProcessingStatus('Envoi de la demande à l’opérateur…');

    // One key per wizard attempt: a retry of the same confirmation replays
    // the same payment instead of creating a second one.
    const idempotencyKey = payment.idempotencyKey ?? mintIdempotencyKey(payment.contratId);
    updatePayment({ idempotencyKey });

    try {
      const input: InitiatePaymentInput = {
        contratId: payment.contratId,
        tenantId: user.id,
        amount: payment.amount,
        rentAmount: payment.rentAmount ?? payment.amount,
        currency: 'CDF',
        method: payment.method,
        phone: payment.phone,
        periode: payment.periode ?? new Date().toISOString().slice(0, 7),
        idempotencyKey,
      };

      const result = await paymentService.initiatePayment(input);
      updatePayment({ paymentId: result.paymentId, providerMessage: result.message, failureReason: undefined });

      if (result.state === 'succeeded') {
        setStep('success');
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_SUCCESS}?id=${result.paymentId}`);
        return;
      }
      if (isTerminal(result.state)) {
        setStep('failed');
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_FAILED}?id=${result.paymentId}&reason=${encodeURIComponent('provider_rejected')}`);
        return;
      }
      if (result.redirectUrl && result.state === 'requires_action' && payment.method === 'card') {
        // Card / redirect providers: leave the app, come back on returnUrl.
        window.location.assign(result.redirectUrl);
        return;
      }
      setProcessingStatus(result.message ?? 'Confirmez le paiement sur votre téléphone…');
      // The processing screen now watches the payment (realtime + polling).
    } catch (e) {
      const err = e instanceof PaymentError ? e : new PaymentError('unknown', { details: String(e) });
      setInitiateError(err);
      setStep('failed');
      const id = payment.paymentId ?? '';
      navigate(`${ROUTES.LOCATAIRE.PAYMENT_FAILED}?id=${id}&reason=${encodeURIComponent(err.code)}`);
    } finally {
      initiatingRef.current = false;
    }
  }, [user?.id, payment, navigate, updatePayment]);

  /** Called by the processing screen when the hybrid hook reaches a terminal state. */
  const onPaymentTerminal = useCallback(
    (paymentId: string, state: string, failureReason: string | null) => {
      if (state === 'succeeded') {
        setStep('success');
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_SUCCESS}?id=${paymentId}`);
      } else {
        setStep('failed');
        updatePayment({ failureReason: failureReason ?? undefined });
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_FAILED}?id=${paymentId}&reason=${encodeURIComponent(failureReason ?? state)}`);
      }
    },
    [navigate, updatePayment],
  );

  const reset = useCallback(() => {
    setStep('select');
    setPayment({});
    setProcessingStatus('');
    setInitiateError(null);
    initiatingRef.current = false;
  }, []);

  return {
    step,
    setStep,
    payment,
    setPayment: updatePayment,
    initiate,
    onPaymentTerminal,
    reset,
    processingStatus,
    initiateError,
    computeBreakdown,
    generateIdempotencyKey,
  };
}
