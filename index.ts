export { formatRelativeTime } from './lib/relative-time';
export { ConfirmModal } from './components/ConfirmModal';
export { UndoToast } from './components/UndoToast';
export { ToastContainer, showToast } from './components/ToastContainer';
export { QuotaBadge } from './components/QuotaBadge';
export { QRButton } from './components/QRButton';
export { QRFullscreen, qrSizeFor } from './components/QRFullscreen';

// 한결 v2 수업 대시보드 공용 부품 (BUILDER-UX §4 · DESIGN-POLICY §10-A, 2026-08-31 결재)
export { SessionsHeader } from './components/sessions/SessionsHeader';
export { SessionCard } from './components/sessions/SessionCard';
export { CreateSessionModal } from './components/sessions/CreateSessionModal';
export { StatusPill } from './components/sessions/StatusPill';

// 학생 입장 3단계 (BUILDER-UX §3, E1~E12)
export { JoinFlow } from './components/join/JoinFlow';
export { GroupInputPanel } from './components/GroupInputPanel';
export { ReportButton } from './components/ReportButton';
export { ReportModal } from './components/ReportModal';
export { default as RetryButton } from './components/RetryButton';
export { TrashList } from './components/TrashList';
export { default as WaitTimer } from './components/WaitTimer';
export { default as ModerationModal } from './components/ModerationModal';
export { LICENSE_DEFAULT, buildDownloadName, buildLicenseJson } from './lib/license-inserter/metadata-common';
export { embedImageMetadata } from './lib/license-inserter/image';
export { buildMp4LicenseArgs } from './lib/license-inserter/mp4-server';
export { embedPdfMetadata } from './lib/license-inserter/pdf';
export { useUndoDelete } from './hooks/useUndoDelete';
export { useGroupInput } from './hooks/useGroupInput';
export { usePolling } from './hooks/usePolling';
export { useBeforeUnload } from './hooks/useBeforeUnload';
export { useExitGuard } from './hooks/useExitGuard';
export { useCmdEnter } from './hooks/useCmdEnter';
export { useIosKeyboardScroll } from './hooks/useIosKeyboardScroll';
export { useImeSafeInput, imeEmitValue } from './hooks/useImeSafeInput';
export { EmptyState } from './components/EmptyState';
export { AutosaveIndicator } from './components/AutosaveIndicator';
export { UploadDropzone } from './components/UploadDropzone';
export { VerdictGroup } from './components/VerdictGroup';
export { FocusTrap } from './components/FocusTrap';
export { RouteScrollTop } from './components/RouteScrollTop';
export { DirtyGuardProvider, useDirtyGuardContext } from './components/useDirtyGuard';
export { BackToSessions } from './components/BackToSessions';
export { DemoSessionShell, useDemoSession } from './components/DemoSessionShell';
export { RestoreToast } from './components/RestoreToast';
export { ExitGuardModal } from './components/ExitGuardModal';

export type { FormatRelativeTimeOptions, RelativeTimeMode } from './lib/relative-time';
export type { ConfirmModalProps } from './components/ConfirmModal';
export type { UndoToastProps } from './components/UndoToast';
export type { BasicToastOptions, ShowToastOptions, UndoToastOptions } from './components/ToastContainer';
export type { QuotaBadgeProps } from './components/QuotaBadge';
export type { QRButtonProps } from './components/QRButton';
export type { QRFullscreenProps } from './components/QRFullscreen';
export type { GroupInputPanelProps, GroupInputMode, GroupProposal } from './components/GroupInputPanel';
export type { ReportButtonProps, ReportModalProps, ReportPayload } from './components/ReportButton';
export type { RetryButtonProps } from './components/RetryButton';
export type { TrashItem, TrashListProps } from './components/TrashList';
export type { WaitTimerProps } from './components/WaitTimer';
export type { ModerationCategory, ModerationModalProps, ModerationResource } from './components/ModerationModal';
export type { EmptyStateContext, EmptyStateProps } from './components/EmptyState';
export type { LicenseMeta } from './lib/license-inserter/metadata-common';
export type { UseUndoDeleteOptions, UseUndoDeleteReturn } from './hooks/useUndoDelete';
export type { UseGroupInputOptions, UseGroupInputReturn } from './hooks/useGroupInput';
export type { PollingStatus, UsePollingOptions, UsePollingReturn } from './hooks/usePolling';
export type { UseBeforeUnloadOptions } from './hooks/useBeforeUnload';
export type { UseExitGuardOptions, UseExitGuardReturn, ExitGuardCallback } from './hooks/useExitGuard';
export type { UseCmdEnterOptions } from './hooks/useCmdEnter';
export type { UseIosKeyboardScrollOptions } from './hooks/useIosKeyboardScroll';
export type { ImeSafeInputHandlers } from './hooks/useImeSafeInput';
export type { AutosaveIndicatorProps, AutosaveStatus } from './components/AutosaveIndicator';
export type {
  UploadDropzoneProps,
  UploadDropzoneStatus,
  UploadRejectReason,
} from './components/UploadDropzone';
export type { VerdictGroupProps, VerdictValue, VerdictOption, VerdictTone } from './components/VerdictGroup';
export type { FocusTrapProps } from './components/FocusTrap';
export type { DirtyGuardValue, DirtyGuardProviderProps } from './components/useDirtyGuard';
export type { BackToSessionsAudience, BackToSessionsProps } from './components/BackToSessions';
export type { DemoSessionShellProps } from './components/DemoSessionShell';
export type { RestoreToastProps, RestoreToastSource } from './components/RestoreToast';
export type { ExitGuardModalProps, ExitGuardAudience, ExitGuardModalGuardProps } from './components/ExitGuardModal';
export type { SessionsHeaderProps } from './components/sessions/SessionsHeader';
export type { SessionCardProps } from './components/sessions/SessionCard';
export type { CreateSessionModalProps } from './components/sessions/CreateSessionModal';
export type { StatusPillProps } from './components/sessions/StatusPill';
export type {
  SessionSummary,
  SessionStat,
  SessionActivity,
  SessionStatus,
  StudentStatus,
} from './components/sessions/types';
export type { JoinFlowProps, JoinResult, JoinFailureReason } from './components/join/JoinFlow';
