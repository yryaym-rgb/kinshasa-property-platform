import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '@/services/payment/paymentService';
import { taxService } from '@/services/tax/taxService';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';
import type {
  PaymentStep,
  PaymentWizardState,
  PaymentProviderId,
  InitiatePaymentInput,
} from '@/services/payment/types';
import { isMobileMoneyProvider } from '@/services/payment/types';

function generateIdempotencyKey(): string {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function usePayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<PaymentStep>('select');
  const [payment, setPayment] = useState<PaymentWizardState>({});
  const [processingStatus, setProcessingStatus] = useState('');
  const initiatingRef = useRef(false);

  const updatePayment = useCallback((updates: Partial<PaymentWizardState>) => {
    setPayment((prev) => ({ ...prev, ...updates }));
  }, []);

  const computeBreakdown = useCallback(
    (rentAmount: number, method?: PaymentProviderId) => {
      const paymentMethod = method && isMobileMoneyProvider(method) ? 'mobile_money' : method === 'card' ? 'card' : 'bank';
      const breakdown = taxService.calculateTax({ rentAmount, paymentMethod });
      return { ...breakdown, method: method ?? 'orange_money' };
    },
    [],
  );

  const initiate = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!user?.id || !payment.contratId || !payment.amount || !payment.method) return;

    initiatingRef.current = true;
    setStep('processing');

    const statuses = [
      { msg: `Connexion à ${payment.method === 'orange_money' ? 'Orange Money' : payment.method === 'mpesa' ? 'M-Pesa' : payment.method === 'airtel_money' ? 'Airtel Money' : 'le service'}...`, delay: 1000 },
      { msg: 'Envoi de la demande...', delay: 1000 },
      { msg: 'Validation...', delay: 2000 },
      { msg: 'Confirmation...', delay: 1000 },
    ];

    for (const s of statuses) {
      setProcessingStatus(s.msg);
      await new Promise((r) => setTimeout(r, s.delay));
    }

    const idempotencyKey = payment.idempotencyKey ?? generateIdempotencyKey();
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

      if (result.status === 'success' && result.payment) {
        setStep('success');
        updatePayment({ paymentId: result.payment.id });
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_SUCCESS}?id=${result.payment.id}`);
      } else {
        setStep('failed');
        updatePayment({ failureReason: result.failureReason, paymentId: result.payment?.id });
        const reason = result.failureReason ?? 'provider_error';
        const id = result.payment?.id ?? '';
        navigate(`${ROUTES.LOCATAIRE.PAYMENT_FAILED}?id=${id}&reason=${reason}`);
      }
    } catch {
      setStep('failed');
      navigate(`${ROUTES.LOCATAIRE.PAYMENT_FAILED}?reason=provider_error`);
    } finally {
      initiatingRef.current = false;
    }
  }, [user?.id, payment, navigate, updatePayment]);

  const reset = useCallback(() => {
    setStep('select');
    setPayment({});
    setProcessingStatus('');
    initiatingRef.current = false;
  }, []);

  return {
    step,
    setStep,
    payment,
    setPayment: updatePayment,
    initiate,
    reset,
    processingStatus,
    computeBreakdown,
    generateIdempotencyKey,
  };
}
