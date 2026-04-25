import { buildLicenseJson, resolveLicenseMeta, type LicenseMeta } from './metadata-common';

export function buildMp4LicenseArgs(meta: LicenseMeta): string[] {
  const normalized = resolveLicenseMeta(meta);
  return [
    '-metadata',
    `title=${normalized.app} · ${normalized.sessionCode}`,
    '-metadata',
    `comment=${buildLicenseJson(normalized)}`,
    '-metadata',
    `license=${normalized.license}`,
  ];
}
