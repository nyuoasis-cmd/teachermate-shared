## Summary
- Wave 4 단계 1 공유 인프라 자산을 `@teachermate/shared`에 추가했습니다.
- Quota/Report/Trash UI 4종과 라이선스 유틸 4종을 export에 연결했습니다.
- Supabase 마이그레이션 3종은 DB 적용 완료 상태를 기준으로 코드 참조용으로 포함했습니다.

## 신규 export
- value 1: `QuotaBadge`
- value 2: `ReportButton`
- value 3: `ReportModal`
- value 4: `TrashList`
- value 5: `LICENSE_DEFAULT`, `buildLicenseJson`, `buildDownloadName`
- value 6: `embedImageMetadata`
- value 7: `embedPdfMetadata`
- value 8: `buildMp4LicenseArgs`
- type 1: `QuotaBadgeProps`
- type 2: `ReportButtonProps`
- type 3: `ReportModalProps`
- type 4: `ReportPayload`
- type 5: `TrashListProps`, `TrashItem`
- type 6: `LicenseMeta`

## 마이그레이션
- `migrations/wave4-1-quota.sql`
- `migrations/wave4-2-reports.sql`
- `migrations/wave4-3-generations.sql`
- DB 적용 완료, 코드는 참조용입니다.

## Test plan
- `npm test`
- `npm run build`
- `npm run typecheck`

## 다운스트림 영향
- 단계 2~4 진입 시 3앱 `package.json`의 `@teachermate/shared` sha 업데이트가 1회 필요합니다.
