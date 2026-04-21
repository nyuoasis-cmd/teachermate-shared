export type RelativeTimeMode = 'default' | 'compact' | 'past-only';

export interface FormatRelativeTimeOptions {
  mode?: RelativeTimeMode;
  now?: Date;
  locale?: 'ko' | 'en';
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTime(
  timestamp: string | Date,
  options: FormatRelativeTimeOptions = {},
): string {
  const mode = options.mode ?? 'default';
  const locale = options.locale ?? 'ko';
  const now = options.now ?? new Date();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return locale === 'en'
      ? mode === 'default'
        ? 'Just started'
        : 'Just now'
      : mode === 'default'
        ? '방금 시작'
        : '방금';
  }

  if (diffMs < MINUTE_MS) {
    return locale === 'en' ? 'Just now' : '방금';
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return locale === 'en' ? `${minutes}m ago` : `${minutes}분 전`;
  }

  const diffDays = getCalendarDayDiff(date, now);

  if (diffDays === 0) {
    if (mode === 'compact') {
      return locale === 'en' ? 'Today' : '오늘';
    }
    return locale === 'en' ? `Today ${formatHHMM(date)}` : `오늘 ${formatHHMM(date)}`;
  }

  if (diffDays === 1) {
    return locale === 'en' ? 'Yesterday' : '어제';
  }

  if (diffDays <= 6) {
    if (locale === 'en') {
      return mode === 'compact' ? `${diffDays}d` : `${diffDays} days ago`;
    }
    return mode === 'compact' ? `${diffDays}일` : `${diffDays}일 전`;
  }

  if (diffDays <= 29) {
    const weeks = Math.floor(diffDays / 7);
    if (locale === 'en') {
      return mode === 'compact' ? `${weeks}w` : `${weeks} weeks ago`;
    }
    return `${weeks}주 전`;
  }

  if (diffDays <= 364) {
    const months = Math.floor(diffDays / 30);
    if (locale === 'en') {
      return mode === 'compact' ? `${months}mo` : `${months} months ago`;
    }
    return mode === 'compact' ? `${months}mo` : `${months}개월 전`;
  }

  return formatAbsolute(date, locale, mode === 'compact');
}

function getCalendarDayDiff(target: Date, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const otherDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.floor((today.getTime() - otherDay.getTime()) / DAY_MS);
}

function formatAbsolute(date: Date, locale: 'ko' | 'en', compact: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  if (compact) {
    return `${year}.${month}`;
  }

  const day = String(date.getDate()).padStart(2, '0');
  return locale === 'en' ? `${year}.${month}.${day}` : `${year}.${month}.${day}`;
}

function formatHHMM(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
