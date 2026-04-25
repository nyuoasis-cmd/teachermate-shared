export type LicenseAppName = 'meta-character' | 'ar-storybook' | 'ai-music-video';

export interface LicenseMeta {
  app: LicenseAppName;
  generationId: string;
  sessionCode: string;
  studentName?: string;
  generatedAt: string;
  license?: string;
  publicUrl?: string;
}

export const LICENSE_DEFAULT = 'CC BY-NC-SA 4.0';

function requireText(value: string | undefined, fieldName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} 값이 필요해요`);
  }
  return value.trim();
}

function normalizeLicenseMeta(meta: LicenseMeta) {
  const app = requireText(meta.app, 'app') as LicenseAppName;
  const generationId = requireText(meta.generationId, 'generationId');
  const sessionCode = requireText(meta.sessionCode, 'sessionCode');
  const generatedAt = requireText(meta.generatedAt, 'generatedAt');
  const parsedDate = new Date(generatedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('generatedAt 값이 올바르지 않아요');
  }

  return {
    app,
    generationId,
    sessionCode,
    generatedAt: parsedDate.toISOString(),
    studentName: meta.studentName?.trim() || undefined,
    license: meta.license?.trim() || LICENSE_DEFAULT,
    publicUrl: meta.publicUrl?.trim() || undefined,
  };
}

function sanitizeSegment(value: string) {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildLicenseJson(meta: LicenseMeta): string {
  const normalized = normalizeLicenseMeta(meta);
  return JSON.stringify({
    app: normalized.app,
    generationId: normalized.generationId,
    sessionCode: normalized.sessionCode,
    generatedAt: normalized.generatedAt,
    license: normalized.license,
    studentName: normalized.studentName,
    publicUrl: normalized.publicUrl,
  });
}

export function buildDownloadName(meta: LicenseMeta, ext: string): string {
  const normalized = normalizeLicenseMeta(meta);
  const resolvedExt = requireText(ext.replace(/^\./, ''), 'ext');
  const studentSegment = sanitizeSegment(normalized.studentName ?? 'student') || 'student';
  const formattedDate = normalized.generatedAt
    .replace(/[-:TZ.]/g, '')
    .slice(2, 12);
  const baseName = `${normalized.app}-${normalized.sessionCode.slice(0, 6)}-${Array.from(studentSegment).slice(0, 8).join('')}-${formattedDate}`;
  const sanitizedBaseName = baseName.replace(/-+/g, '-').slice(0, Math.max(1, 80 - resolvedExt.length - 1));
  return `${sanitizedBaseName}.${resolvedExt}`;
}

export function formatLicenseTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('generatedAt 값이 올바르지 않아요');
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const date = `${parsed.getDate()}`.padStart(2, '0');
  const hours = `${parsed.getHours()}`.padStart(2, '0');
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${date} ${hours}:${minutes}`;
}

export function resolveLicenseMeta(meta: LicenseMeta) {
  return normalizeLicenseMeta(meta);
}
