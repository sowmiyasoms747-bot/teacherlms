# SCORM preview and upload: integration dependencies

This repository is the Teacher Portal front end only. It has no backend, no Admin API, no Student Portal player and no shared gradebook, and library data lives in the browser's localStorage. Uploaded ZIPs are validated in the browser and only their name, size and validation result are kept; the bytes are not stored.

The Teacher side of TCH-01 and TCH-02 is built against the contract below. Until a server implements it, **Preview as Student shows "player isn't connected" and cannot launch**, and the upload form uses the built-in shared rules.

## Configuration

| Variable | Meaning |
|---|---|
| `VITE_LMS_API_URL` | Base URL of the LMS API, e.g. `https://api.example-school.org`. Requests send cookies (`credentials: 'include'`). |
| `VITE_STUDENT_PLAYER_ORIGIN` | Origin of the Student Portal SCORM player. Launch URLs from any other origin are refused and not framed. |

Both must be set for preview to launch.

## Endpoints the Teacher app calls

### `GET /teacher/scorm/rules`
Returns the **effective** upload rules, the same ones the Admin Portal and the upload service enforce:
```json
{ "versions": ["SCORM 1.2", "SCORM 2004"], "extensions": [".zip"], "maxBytes": 524288000 }
```
If this fails, the form falls back to `SCORM_RULES` in `src/scorm.ts` (1.2 / 2004, .zip, 500 MB, from the Admin audit). **The 500 MB figure has not been checked against the real backend limit.** Confirm it, or serve this endpoint, before release.

### `POST /teacher/content/{materialId}/preview-attempts`
Body: `{ "mode": "staff-preview" }`. The server must:
1. Check that the signed-in teacher is assigned to the material's section and subject. Answer `403` (or `404`) otherwise. This is the real guard for direct preview links; the client check only hides the option.
2. Answer `409 { "reason": "..." }` when the file is missing or validation is pending or failed.
3. Create an attempt flagged as staff preview, kept out of student progress, attempts, grades, reports and completion totals.
4. Leave the material's visibility unchanged. A draft must stay hidden from students.
5. Answer `201 { "attemptId": "...", "launchUrl": "https://<player origin>/..." }`, where `launchUrl` opens the Student Portal's own player with the package's detected SCORM version.

### `GET /teacher/preview-attempts/{attemptId}`
Returns what the player recorded for that preview attempt: `{ "completion": "completed", "success": "passed", "score": 85 }`.

### Upload and replace (not yet called)
The library keeps materials locally. A real upload endpoint must run the same validator on the server, check that the section and subject are assigned to the teacher (rule in `targetError`, `src/content.ts`), use the active school and academic year, and deliver a published item only to that section's learners.

## Not modelled in this repository
- **Streams**: the class data has no stream field, so no stream picker is shown. Add one when the API exposes streams for a section.
- **School / academic year**: there is no school or year context in the data, so uploads are scoped by section only.

## Checks that need a shared QA environment
These cannot be verified from this repository and are **unverified**:
- Known-good SCORM 1.2 and 2004 QA packages launch in the Student player and report completion and score in the preview attempt only.
- A teacher without access is refused by the server when opening a preview link directly.
- A material published to Class 12-A appears for an eligible learner and stays hidden from an excluded one in the Student Portal.
- Real learner completion and score reach the shared gradebook, separately from preview activity.
