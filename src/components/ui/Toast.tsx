import toast, { Toaster as HotToaster, type ToastOptions } from 'react-hot-toast';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const baseStyle: React.CSSProperties = {
  borderRadius: '0.75rem',
  padding: '12px 16px',
  fontSize: '14px',
  maxWidth: '420px',
  boxShadow: 'var(--shadow-lg)',
};

const toastOptions: ToastOptions = {
  duration: 4000,
  style: baseStyle,
  position: typeof window !== 'undefined' && window.innerWidth < 768 ? 'top-center' : 'top-right',
};

export const toastSuccess = (message: string) =>
  toast.custom(
    (t) => (
      <div
        className={`${t.visible ? 'animate-slide-up' : ''} flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800`}
        role="status"
      >
        <CheckCircle className="h-5 w-5 shrink-0" />
        <span>{message}</span>
      </div>
    ),
    toastOptions,
  );

export const toastError = (message: string) =>
  toast.custom(
    (t) => (
      <div
        className={`${t.visible ? 'animate-slide-up' : ''} flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800`}
        role="alert"
      >
        <XCircle className="h-5 w-5 shrink-0" />
        <span>{message}</span>
      </div>
    ),
    { ...toastOptions, duration: 6000 },
  );

export const toastInfo = (message: string) =>
  toast.custom(
    (t) => (
      <div className={`${t.visible ? 'animate-slide-up' : ''} flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800`}>
        <Info className="h-5 w-5 shrink-0" />
        <span>{message}</span>
      </div>
    ),
    toastOptions,
  );

export const toastWarning = (message: string) =>
  toast.custom(
    (t) => (
      <div className={`${t.visible ? 'animate-slide-up' : ''} flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800`}>
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>{message}</span>
      </div>
    ),
    toastOptions,
  );

export function Toaster() {
  return (
    <HotToaster
      position={typeof window !== 'undefined' && window.innerWidth < 768 ? 'top-center' : 'top-right'}
      toastOptions={{
        style: {
          background: 'var(--color-card)',
          color: 'var(--color-foreground)',
          border: '1px solid var(--color-border)',
        },
      }}
    />
  );
}

export { toast };
