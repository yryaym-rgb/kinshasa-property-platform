import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useT } from '@/i18n';
import { AUTH_CONFIG } from '@/config/app.config';
import { cn } from '@/lib/cn';
import { AlertCircleIcon, FileTextIcon, TrashIcon, UploadIcon } from '@/components/landing/icons';

export interface DocumentUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label: string;
  hint?: string;
  help?: string;
  error?: string;
  /** Metadata of a previously chosen file when the File object was lost on reload. */
  stale?: { name: string; size: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

/**
 * Drag-and-drop identity-document picker (JPG/PNG/PDF ≤ 5 MB) with a thumbnail
 * preview. Loaded lazily by the registration wizard.
 */
export function DocumentUpload({ file, onChange, label, hint, help, error, stale }: DocumentUploadProps) {
  const t = useT();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!(AUTH_CONFIG.acceptedDocumentTypes as readonly string[]).includes(candidate.type)) {
      setLocalError(t('register.idDoc.badType'));
      return;
    }
    if (candidate.size > AUTH_CONFIG.maxDocumentBytes) {
      setLocalError(t('register.idDoc.tooLarge'));
      return;
    }
    setLocalError(null);
    onChange(candidate);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    accept(e.target.files?.[0]);
    e.target.value = '';
  };

  const shownError = error ?? localError ?? undefined;
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <span className="auth-label" id={`${id}-label`}>
        {label}
        {hint ? <span className="auth-label__hint">{hint}</span> : null}
      </span>

      {file ? (
        <div className="auth-file">
          <span className="auth-file__thumb" aria-hidden="true">
            {previewUrl ? <img src={previewUrl} alt="" /> : <FileTextIcon size={26} />}
          </span>
          <span className="min-w-0 flex-1">
            <p className="auth-file__name">{file.name}</p>
            <p className="auth-file__meta">{formatBytes(file.size)}</p>
          </span>
          <button type="button" className="auth-iconbtn" onClick={() => onChange(null)} aria-label={t('register.idDoc.remove')}>
            <TrashIcon size={20} />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-describedby={shownError ? errorId : `${id}-help`}
          className={cn('auth-drop', dragging && 'auth-drop--active', shownError && 'auth-drop--error')}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="auth-drop__icon" aria-hidden="true">
            <UploadIcon size={22} />
          </span>
          <p className="auth-drop__text">
            {t('register.idDoc.drop')} <b>{t('register.idDoc.browse')}</b>
          </p>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={AUTH_CONFIG.acceptedDocumentTypes.join(',')}
            className="sr-only"
            tabIndex={-1}
            onChange={onInput}
          />
        </div>
      )}

      {shownError ? (
        <p id={errorId} className="auth-error" role="alert">
          <AlertCircleIcon size={15} />
          {shownError}
        </p>
      ) : stale && !file ? (
        <p id={`${id}-help`} className="auth-help">
          <AlertCircleIcon size={15} className="text-drc-gold-ink" />
          <span>
            {stale.name} — {t('register.idDoc.reupload')}
          </span>
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="auth-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}
