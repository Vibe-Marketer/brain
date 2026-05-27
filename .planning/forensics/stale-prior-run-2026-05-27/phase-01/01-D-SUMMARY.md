---
phase: 1
plan: 01-D
status: completed
---

# 01-D-SUMMARY: Remove FileUploadDropzone from Import UI (MAN-06)

- Removed `file-upload` visibility in UI via `uiVisible: false` inside `src/config/source-registry.ts`.
- Removed `OnboardingSourceCard` for file uploads in `src/components/onboarding/OnboardingModal.tsx`.
- Added documentation comment to `FileUploadDropzone.tsx` explaining it is preserved for v2 async transcription pipeline.
- Prevented UI regressions while maintaining existing in-flight Edge Function capabilities.
