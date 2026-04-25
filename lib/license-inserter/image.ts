import piexif from 'piexifjs';
import { LICENSE_DEFAULT, buildLicenseJson, formatLicenseTimestamp, resolveLicenseMeta, type LicenseMeta } from './metadata-common';

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('이미지 데이터를 읽지 못했어요'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('이미지 데이터를 변환하지 못했어요'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function embedImageMetadata(blob: Blob, meta: LicenseMeta): Promise<Blob> {
  const normalized = resolveLicenseMeta(meta);
  const encodedLicenseJson = encodeURIComponent(buildLicenseJson(normalized));
  const encodedArtist = encodeURIComponent(normalized.studentName ?? 'TeacherMate Student');
  const dataUrl = await blobToDataUrl(blob);
  const exifObj = {
    '0th': {
      [piexif.ImageIFD.ImageDescription]: encodedLicenseJson,
      [piexif.ImageIFD.Artist]: encodedArtist,
      [piexif.ImageIFD.Software]: `TeacherMate ${normalized.app}`,
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: formatLicenseTimestamp(normalized.generatedAt).replace(/-/g, ':'),
      [piexif.ExifIFD.UserComment]: `${normalized.license ?? LICENSE_DEFAULT} | ${normalized.generationId} | ${normalized.sessionCode}`,
    },
  };
  const exifStr = piexif.dump(exifObj);
  const newDataUrl = piexif.insert(exifStr, dataUrl);
  return fetch(newDataUrl).then((response) => response.blob());
}
