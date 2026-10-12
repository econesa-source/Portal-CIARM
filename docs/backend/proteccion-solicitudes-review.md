# Registro de implementación y revisión — 2026-10-12

Código preparado, no desplegado. Suite final: 84/84 Node; dos suites PHP y lint correctos. Revisión independiente: cuatro hallazgos importantes corregidos; un problema adicional de navegación reclasificado y corregido. Las pruebas visuales y la aceptación real siguen pendientes.

# SDD ledger — plan: docs/superpowers/plans/2026-10-12-proteccion-solicitudes.md
Execution approved by user 2026-10-12; native implementation, final fresh review.
Base remote: 7c156d7e8025f4eef50f93628f1a8964a3491d88; local equivalent tree from a6188d5.
Pre-flight: Task 1 signed actor dispatch → Tasks 3/4; Task 2 reservation → Task 3 journal; Task 3 CreationState → Tasks 4/5; Task 4 endpoint → Task 5 service; Task 6 compatibility → Task 7 publication. Interfaces agree.
Ruling: maintain explicit legacy flag during deployment, but never merge frontend migration before backend proof — approved design — premature merge would break live creation.
Ruling: cloud workflow helper scripts have no local path; use equivalent task briefs, local ledger and per-task commands — same evidence and checkpoints — missing bookkeeping would risk repeated work.
Task 1: started; read plan Task 1 and approved spec.
Task 1: complete; mine/capabilities identity, signature, time, nonce and busy tests RED→GREEN; npm test 57/57. Commit recorded in git.
Ruling: administrative requests reverify HMAC in their original handler after the common signature/identity check, consuming nonce only once — avoids replacing proven assignment recovery — costs one extra HMAC on small administrative envelopes.
Task 2: started; read Task 2 brief; allocator under caller lock.
Task 2: complete; full-range allocation, gaps, historical year, reservations, duplicates and malformed IDs RED→GREEN; suite 60/60. Allocator appends after existing data and journal reservations, under caller lock.
Task 3: started; read Task 3 brief.
Task 3: complete; creation/attachments, max 5x10MiB, recover partial row/file/confirmation/audit snapshots, filter incomplete records; RED→GREEN suite 71/71.
Ruling: use a linear base64 charset check plus canonical re-encoding instead of grouped regex — grouped matcher overflowed on valid 10MiB files — protects allowed upload sizes.
Task 4: started; read PHP transport brief.
Task 4: code complete; PHP policy/upload/MIME/max-size checks RED→GREEN, existing 15 authorization checks pass, PHP lint passes; Node suite 71/71. Hosting capabilities and real multipart integration remain Task 7 acceptance.
Ruling: separate multipart is_uploaded_file boundary from pure file-payload validation — test local fixtures without a product test hook — live multipart needs staging acceptance.
Task 5: started; read frontend brief.
Task 5: complete code and DOM/transport tests RED→GREEN; npm test 77/77. Native visual inspection remains blocked by browser socket restrictions and must be performed in staging.
Task 6: started; unsigned dispatch tests RED→GREEN.
Ruling: creationStatus exposes finalizing reservation state — prevents abandoning an operation that may have written a ticket — if wrong, discard would permit duplicate creation.
Task 6: complete code; dispatch RED→GREEN, npm test 78/78, both PHP suites pass, deterministic build and whitespace check. Draft PR publication follows final review. No runtime deployment performed.
Task 7: started; real staging and production acceptance pending an authorized usable connection/manual deployment; backend procedure records exact gates.
Final review: fresh reviewer gpt-6-astra, a6188d5..b868a6f; four Important findings and two proposed minors.
Final: fixed duplicate submission after success — terminal disabled form RED→GREEN.
Final: fixed accepted oversized journal — full projected reservation/receipts preflight rejects before accepting operation RED→GREEN; no text truncation.
Final: fixed leading apostrophe coercion conflict — protect and decode literal text consistently RED→GREEN.
Final: fixed deployment assertions requiring public legacy reads — authenticated transport/public-denial checks RED→GREEN.
Final: regraded late mine response overwrite Important because it can replace the next screen; abort/suppress navigation response RED→GREEN.
Final: minor (deferred): NOT_CONFIGURED maps to 502 rather than 503; still explicit failure, never authorization or success.
Final: Ruling: reject metadata whose projected journal exceeds capacity before accepting it — prevents permanently stuck finalized drafts while preserving all accepted text — if wrong, a request could be rejected unnecessarily; technical bounds must be communicated.
Final: Ruling: real Sheets/formula layouts remain staging acceptance — fixtures cannot prove physical template behavior — if wrong, runtime may conflict or lose derived calculations; no production merge until verified.
Final: Ruling: real multipart/peak memory/capabilities remain staging acceptance — CLI tests do not prove hosting resource behavior — if wrong, uploads may fail despite local success; deployment blocked pending proof.
Final: Ruling: backend deployment acceptance remains pending — no usable authorized direct Apps Script connection — if wrong, premature frontend publication breaks the current form.
