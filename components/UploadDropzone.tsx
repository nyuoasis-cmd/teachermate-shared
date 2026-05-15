import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react';

export type UploadDropzoneStatus =
  | 'idle'
  | 'drag-over'
  | 'uploading'
  | 'success'
  | 'error'
  | 'cancel';

export type UploadRejectReason = 'mime' | 'size';

export interface UploadDropzoneProps {
  status: UploadDropzoneStatus;
  onStatusChange?: (status: UploadDropzoneStatus) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  onFiles: (files: File[]) => void;
  onReject?: (reason: UploadRejectReason, files: File[]) => void;
  onRetry?: () => void;
  helpText?: string;
  dragOverText?: string;
  errorText?: string;
  progress?: number;
  preview?: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  disabled?: boolean;
  id?: string;
}

const DEFAULT_HELP = '파일을 끌어놓거나 아래 버튼을 눌러주세요';
const DEFAULT_DRAG_OVER = '여기에 놓으세요';
const DEFAULT_ERROR = '업로드에 실패했어요';

export function UploadDropzone({
  status,
  onStatusChange,
  accept,
  multiple = false,
  maxSizeBytes,
  onFiles,
  onReject,
  onRetry,
  helpText = DEFAULT_HELP,
  dragOverText = DEFAULT_DRAG_OVER,
  errorText = DEFAULT_ERROR,
  progress,
  preview,
  primaryAction,
  secondaryAction,
  disabled = false,
  id,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [innerStatus, setInnerStatus] = useState<UploadDropzoneStatus | null>(null);

  const setStatus = useCallback(
    (next: UploadDropzoneStatus) => {
      if (onStatusChange) onStatusChange(next);
      else setInnerStatus(next);
    },
    [onStatusChange],
  );

  const effectiveStatus = onStatusChange ? status : (innerStatus ?? status);

  const acceptsMime = useCallback(
    (file: File) => {
      if (!accept) return true;
      const patterns = accept.split(',').map((p) => p.trim()).filter(Boolean);
      return patterns.some((pattern) => {
        if (pattern.startsWith('.')) {
          return file.name.toLowerCase().endsWith(pattern.toLowerCase());
        }
        if (pattern.endsWith('/*')) {
          const prefix = pattern.slice(0, -1);
          return file.type.startsWith(prefix);
        }
        return file.type === pattern;
      });
    },
    [accept],
  );

  const validate = useCallback(
    (files: File[]): { ok: File[]; rejected: { reason: UploadRejectReason; files: File[] } | null } => {
      const mimeRejected = files.filter((f) => !acceptsMime(f));
      if (mimeRejected.length > 0) {
        return { ok: [], rejected: { reason: 'mime', files: mimeRejected } };
      }
      if (maxSizeBytes !== undefined) {
        const sizeRejected = files.filter((f) => f.size > maxSizeBytes);
        if (sizeRejected.length > 0) {
          return { ok: [], rejected: { reason: 'size', files: sizeRejected } };
        }
      }
      return { ok: files, rejected: null };
    },
    [acceptsMime, maxSizeBytes],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const { ok, rejected } = validate(files);
      if (rejected) {
        onReject?.(rejected.reason, rejected.files);
        return;
      }
      onFiles(ok);
    },
    [validate, onFiles, onReject],
  );

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setStatus('drag-over');
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setStatus('idle');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setStatus('idle');
    handleFiles(event.dataTransfer?.files ?? null);
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const zoneStyle: CSSProperties = {
    padding: '20px 16px',
    borderRadius: '10px',
    border: `1px dashed ${
      effectiveStatus === 'drag-over'
        ? 'var(--color-info, #2563eb)'
        : effectiveStatus === 'error'
          ? 'var(--color-danger-fg, #b91c1c)'
          : 'var(--color-border-hover, #d6d3d1)'
    }`,
    background:
      effectiveStatus === 'drag-over'
        ? 'var(--color-info-bg, #eff6ff)'
        : effectiveStatus === 'error'
          ? 'var(--color-danger-bg, #fef2f2)'
          : 'var(--color-surface-alt, #fafaf9)',
    textAlign: 'center',
    transition: 'border-color 160ms cubic-bezier(.2,.8,.2,1), background 160ms cubic-bezier(.2,.8,.2,1)',
    cursor: disabled ? 'not-allowed' : undefined,
    opacity: disabled ? 0.6 : 1,
    wordBreak: 'keep-all',
  };

  return (
    <div
      id={id}
      role="region"
      aria-label="파일 업로드"
      data-status={effectiveStatus}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={zoneStyle}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
        data-testid="upload-dropzone-input"
      />

      {effectiveStatus === 'success' && preview ? (
        <div style={{ marginBottom: '10px' }}>{preview}</div>
      ) : null}

      <p
        style={{
          fontSize: '13px',
          color: 'var(--color-text-muted, #78716c)',
          marginBottom: '10px',
        }}
      >
        {effectiveStatus === 'drag-over'
          ? dragOverText
          : effectiveStatus === 'error'
            ? errorText
            : helpText}
      </p>

      {(primaryAction || secondaryAction) &&
      effectiveStatus !== 'uploading' &&
      effectiveStatus !== 'error' ? (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={disabled}
              style={actionButtonStyle}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={disabled}
              style={actionButtonStyle}
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {!primaryAction && !secondaryAction && effectiveStatus !== 'uploading' && effectiveStatus !== 'error' ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          style={actionButtonStyle}
        >
          파일 선택
        </button>
      ) : null}

      {effectiveStatus === 'uploading' ? (
        <p
          role="status"
          aria-live="polite"
          style={{
            fontSize: '12px',
            color: 'var(--color-text-muted, #78716c)',
            marginTop: '6px',
          }}
        >
          업로드 중…
          {typeof progress === 'number' ? ` ${Math.max(0, Math.min(100, Math.round(progress)))}%` : ''}
        </p>
      ) : null}

      {effectiveStatus === 'error' && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            ...actionButtonStyle,
            color: 'var(--color-danger-fg, #b91c1c)',
            borderColor: 'var(--color-danger-fg, #b91c1c)',
            marginTop: '6px',
          }}
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

const actionButtonStyle: CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid var(--color-border, #e7e5e4)',
  background: 'var(--color-surface, #ffffff)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-body, #57534e)',
  minHeight: '44px',
};
