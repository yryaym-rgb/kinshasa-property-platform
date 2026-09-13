import { useCallback, useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/config/supabase';
import { Button } from './Button';
import type { FileUploadResult } from '@/types';

const ACCEPTED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  pdf: ['application/pdf'],
};

export interface FileUploadProps {
  bucket?: string;
  folder?: string;
  accept?: 'image' | 'pdf' | 'all';
  multiple?: boolean;
  maxSizeMB?: number;
  onUpload?: (results: FileUploadResult[]) => void;
  onError?: (error: string) => void;
  label?: string;
  disabled?: boolean;
}

export function FileUpload({
  bucket = 'documents',
  folder = 'uploads',
  accept = 'all',
  multiple = false,
  maxSizeMB = 10,
  onUpload,
  onError,
  label = 'Téléverser un fichier',
  disabled,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileUploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedMimeTypes = accept === 'image'
    ? ACCEPTED_TYPES.image
    : accept === 'pdf'
      ? ACCEPTED_TYPES.pdf
      : [...ACCEPTED_TYPES.image, ...ACCEPTED_TYPES.pdf];

  const uploadFile = async (file: File): Promise<FileUploadResult> => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw new Error(error.message);

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return {
      url: urlData.publicUrl,
      path,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  };

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const toUpload = multiple ? Array.from(fileList) : [fileList[0]!];
      const maxBytes = maxSizeMB * 1024 * 1024;

      for (const file of toUpload) {
        if (!acceptedMimeTypes.includes(file.type)) {
          onError?.(`Type de fichier non supporté: ${file.name}`);
          return;
        }
        if (file.size > maxBytes) {
          onError?.(`Fichier trop volumineux (max ${maxSizeMB} Mo): ${file.name}`);
          return;
        }
      }

      setUploading(true);
      setProgress(0);

      try {
        const results: FileUploadResult[] = [];
        for (let i = 0; i < toUpload.length; i++) {
          const result = await uploadFile(toUpload[i]!);
          results.push(result);
          setProgress(Math.round(((i + 1) / toUpload.length) * 100));
        }
        setFiles((prev) => (multiple ? [...prev, ...results] : results));
        onUpload?.(results);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Erreur de téléversement');
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [acceptedMimeTypes, maxSizeMB, multiple, onError, onUpload],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium">{label}</label>}

      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          dragOver ? 'border-[var(--color-primary)] bg-[var(--color-accent)]' : 'border-[var(--color-border)]',
          disabled && 'opacity-50 pointer-events-none',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="mb-2 h-8 w-8 text-[var(--color-muted-foreground)]" />
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Glissez-déposez ou{' '}
          <button
            type="button"
            className="text-[var(--color-primary)] underline"
            onClick={() => inputRef.current?.click()}
          >
            parcourez
          </button>
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Max {maxSizeMB} Mo • {accept === 'image' ? 'Images' : accept === 'pdf' ? 'PDF' : 'Images et PDF'}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={acceptedMimeTypes.join(',')}
          multiple={multiple}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">Téléversement... {progress}%</p>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li key={file.path} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3">
              {file.type.startsWith('image/') ? (
                <>
                  <ImageIcon className="h-5 w-5 shrink-0 text-[var(--color-muted-foreground)]" />
                  <img src={file.url} alt={file.name} className="h-10 w-10 rounded object-cover" />
                </>
              ) : (
                <FileText className="h-5 w-5 shrink-0 text-[var(--color-muted-foreground)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {(file.size / 1024).toFixed(1)} Ko
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFile(idx)} aria-label={`Supprimer ${file.name}`}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
