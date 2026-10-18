# Open Questions (agent: append here; owner: answer inline)

1. Timetable API: [RESOLVED] Base URL `https://mygbu.in/schd/api.php` verified with `schd=39` (current semester, 4,278 records) and `schd=40` (next semester). Reverse engineering of `base.apk` confirmed endpoints and period times (1-hour slots from 08:30 to 18:30). Publicly accessible per section without credentials.
2. Does the timetable API need per-student credentials, or is it public per class? [RESOLVED] Public per class/section (`SectionName` such as `BCS-II B`).
3. Final package id and university approval for the GBU name and logo. App name chosen: GBU One. Package ID set to `in.gbu.one`.
4. OCR choice: Tesseract only, or a vision-model key available via env for better accuracy?
5. Who moderates PYQ uploads (owner + which trusted students)?
6. Is there a takedown/contact email to show in About? (Set to `student.gbuone@gmail.com` as placeholder in `.env`).
7. Any official GBU permission or contact for using notice content, or should the app strictly link out to originals?
8. Logo is FINAL (see `docs/LOGO_BRIEF.md`). [RESOLVED] Tracing completed with clean vector mark (`assets/brand/gbu-one-mark.svg`), paths extracted to `logoPaths.ts`, overlay check passed and saved to `docs/qa/logo-overlay.png`, icon set generated.
9. University contact for official approval, logo/crest guidelines and official API access to notices/results.
10. Official GBU seal: owner to obtain the official vector file and usage rules from the university; slot is reserved `<OfficialSeal />`, never redraw it.

