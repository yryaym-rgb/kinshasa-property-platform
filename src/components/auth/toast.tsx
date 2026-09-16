import toast from 'react-hot-toast';
import { CheckIcon, InfoIcon } from '@/components/landing/icons';

/** Compact toast in the auth visual language (no icon library dependency). */
export function authToast(message: string, tone: 'success' | 'info' = 'success') {
  return toast.custom(
    (instance) => (
      <div
        role="status"
        className={[
          'flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px] font-medium shadow-[0_12px_32px_rgba(10,22,40,0.12)]',
          tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-drc-gray-200 bg-white text-drc-navy',
          instance.visible ? 'auth-enter' : 'opacity-0',
        ].join(' ')}
      >
        <span
          className={[
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            tone === 'success' ? 'bg-green-600 text-white' : 'bg-drc-blue text-white',
          ].join(' ')}
          aria-hidden="true"
        >
          {tone === 'success' ? <CheckIcon size={14} /> : <InfoIcon size={14} />}
        </span>
        {message}
      </div>
    ),
    { duration: 2500, id: `auth-${tone}-${message}` },
  );
}
