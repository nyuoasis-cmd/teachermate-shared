import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LICENSE_DEFAULT, formatLicenseTimestamp, resolveLicenseMeta, type LicenseMeta } from './metadata-common';

export async function embedPdfMetadata(blob: Blob, meta: LicenseMeta): Promise<Blob> {
  const normalized = resolveLicenseMeta(meta);
  const bytes = await blob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (pdfDoc.getPageCount() === 0) {
    pdfDoc.addPage();
  }

  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  const { width } = lastPage.getSize();
  const lineOne = `Made with TeacherMate · ${normalized.license ?? LICENSE_DEFAULT} · ${normalized.app} · Session ${normalized.sessionCode}`;
  const lineTwo = `Generated: ${formatLicenseTimestamp(normalized.generatedAt)} · Source: ${normalized.publicUrl ?? 'Private'}`;

  pdfDoc.setTitle(`${normalized.app} · ${normalized.sessionCode}`);
  pdfDoc.setAuthor(normalized.studentName ?? 'TeacherMate Student');
  pdfDoc.setSubject(`License: ${normalized.license ?? LICENSE_DEFAULT} · ${normalized.publicUrl ?? ''}`.trim());
  pdfDoc.setKeywords([normalized.app, normalized.sessionCode, normalized.license ?? LICENSE_DEFAULT]);
  pdfDoc.setCreator(`TeacherMate ${normalized.app}`);

  lastPage.drawRectangle({
    x: 32,
    y: 24,
    width: width - 64,
    height: 42,
    color: rgb(0.98, 0.98, 0.97),
    borderColor: rgb(0.91, 0.9, 0.89),
    borderWidth: 1,
  });
  lastPage.drawText(lineOne, {
    x: 40,
    y: 50,
    size: 9,
    font,
    color: rgb(0.17, 0.15, 0.13),
  });
  lastPage.drawText(lineTwo, {
    x: 40,
    y: 36,
    size: 8,
    font,
    color: rgb(0.34, 0.33, 0.31),
  });

  const output = await pdfDoc.save();
  const outputBytes = new Uint8Array(output);
  const buffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength);
  return new Blob([buffer], { type: 'application/pdf' });
}
