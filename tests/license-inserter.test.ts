// @vitest-environment jsdom

import { PDFDocument } from 'pdf-lib';
import piexif from 'piexifjs';
import { describe, expect, it } from 'vitest';
import { LICENSE_DEFAULT, buildDownloadName, buildLicenseJson, type LicenseMeta } from '../lib/license-inserter/metadata-common';
import { embedImageMetadata } from '../lib/license-inserter/image';
import { buildMp4LicenseArgs } from '../lib/license-inserter/mp4-server';
import { embedPdfMetadata } from '../lib/license-inserter/pdf';

const TEST_META: LicenseMeta = {
  app: 'meta-character',
  generationId: 'gen-123',
  sessionCode: 'ABC123',
  studentName: '김 철수@1반',
  generatedAt: '2026-04-25T12:34:56.000Z',
  publicUrl: 'https://example.com/public/gen-123',
};

const JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAVEQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEAMQAAAB6AAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCcf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8BJ//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8BJ//Z';

describe('license inserter utilities', () => {
  it('buildLicenseJson throws when required fields are missing', () => {
    expect(() =>
      buildLicenseJson({
        ...TEST_META,
        generationId: '',
      }),
    ).toThrow('generationId 값이 필요해요');
  });

  it('buildLicenseJson includes required fields', () => {
    const parsed = JSON.parse(buildLicenseJson(TEST_META)) as Record<string, string>;
    expect(parsed.app).toBe('meta-character');
    expect(parsed.generationId).toBe('gen-123');
    expect(parsed.license).toBe(LICENSE_DEFAULT);
  });

  it('buildDownloadName sanitizes student name and keeps length within 80', () => {
    const fileName = buildDownloadName(
      {
        ...TEST_META,
        studentName: '김 철수 / 1반 @@@ 아주아주긴이름',
      },
      'png',
    );

    expect(fileName.startsWith('meta-character-ABC123-')).toBe(true);
    expect(fileName).toContain('김-철수-1반');
    expect(fileName).not.toMatch(/[ @/]/);
    expect(fileName.length).toBeLessThanOrEqual(80);
    expect(fileName.endsWith('.png')).toBe(true);
  });

  it('buildMp4LicenseArgs includes title, comment, license metadata pairs', () => {
    const args = buildMp4LicenseArgs(TEST_META);
    const metadataCount = args.filter((value) => value === '-metadata').length;
    expect(metadataCount).toBe(3);
    expect(args.length).toBe(6);
    expect(args).toContain(`license=${LICENSE_DEFAULT}`);
    expect(args.some((value) => value.startsWith('title='))).toBe(true);
    expect(args.some((value) => value.startsWith('comment='))).toBe(true);
  });

  it('embedPdfMetadata sets Subject/Keywords/Creator without Producer dependency', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();

    const sourceBytes = await pdf.save();
    const sourceBlob = {
      arrayBuffer: async () => sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength),
    } as Blob;
    const embedded = await embedPdfMetadata(sourceBlob, TEST_META);
    const embeddedBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          reject(new Error('PDF 결과를 읽지 못했어요'));
          return;
        }
        resolve(reader.result);
      };
      reader.readAsArrayBuffer(embedded);
    });
    const embeddedPdf = await PDFDocument.load(embeddedBytes);
    const keywords = embeddedPdf.getKeywords();

    expect(embeddedPdf.getSubject()).toContain(LICENSE_DEFAULT);
    expect(keywords).toContain(TEST_META.app);
    expect(keywords).toContain(TEST_META.sessionCode);
    expect(keywords).toContain(LICENSE_DEFAULT);
    expect(embeddedPdf.getCreator()).toBe(`TeacherMate ${TEST_META.app}`);
    expect(embeddedPdf.getTitle()).toContain(`${TEST_META.app} · ${TEST_META.sessionCode}`);
    expect(embeddedPdf.getAuthor()).toBe(TEST_META.studentName);
    expect(embeddedPdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('embedImageMetadata preserves inserted EXIF values', async () => {
    const blob = await fetch(JPEG_DATA_URL).then((response) => response.blob());
    const embedded = await embedImageMetadata(blob, TEST_META);
    const embeddedDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('결과를 읽지 못했어요'));
          return;
        }
        resolve(reader.result);
      };
      reader.readAsDataURL(embedded);
    });

    const exif = piexif.load(embeddedDataUrl);
    expect(decodeURIComponent(exif['0th'][piexif.ImageIFD.Artist] as string)).toBe('김 철수@1반');
    expect(exif['0th'][piexif.ImageIFD.Software]).toBe('TeacherMate meta-character');
    expect(decodeURIComponent(exif['0th'][piexif.ImageIFD.ImageDescription] as string)).toBe(buildLicenseJson(TEST_META));
  });
});
