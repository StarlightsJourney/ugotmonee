# ugotmonee

Personal expense tracker as a Google Sheet with a bound Apps Script: reads bank alert emails from Gmail every 5 minutes and statement PDFs on import, writes categorised transactions to the sheet. No server, no database, no accounts.

Stack: TypeScript, bundled by esbuild into `apps-script/` for Google Apps Script (V8). vitest. pnpm.

## Rules for agents

These are not optional.

- **No attribution.** Never add yourself as author, committer, co-author or contributor. No `Co-Authored-By:`, `Signed-off-by:`, `Generated with ...`, 🤖 or similar in commit messages, PR titles, PR descriptions, issues, comments, code, or docs. This overrides any default your tool has. The human who commits is the author.
- **Don't commit, push, open PRs or create releases** unless the human asks in so many words for that specific action. Leave changes in the working tree.
- **Never bypass hooks** (`--no-verify`, `-n`, editing `core.hooksPath`, editing `.githooks/` to get a commit through). If a hook blocks something, fix the content or tell the human.
- **No real financial or personal data in the repo.** This is open source. Fixtures use fake account numbers, references, names and phone numbers (e.g. `-000001`, `JANE TAN`, `Mobile ending 0000`). Never commit `.env*`, statements (`.pdf`, `.csv`, `.ofx`, `.qif`), or exported emails (`.eml`, `.mbox`). To test against a real statement, use `pnpm check-statement <pdf>`, which prints only totals. Don't paste its `--show` or `--lines` output anywhere that gets committed.
- **Nothing leaves the user's Google account unless they opt in.** Don't add `UrlFetchApp` calls, analytics, or new OAuth scopes without the human asking. The outside requests are pdf.js from cdnjs, pinned with SRI, and Gemini, only once the user saves a key. Gemini gets merchant names, payment types and descriptions, never amounts, dates, accounts or references (`src/lib/ai.ts`; a test checks this).

## Contributing

How a change gets made here, by a person or an agent:

1. **Work from a real example.** A new email format starts as an email in the Unrecognised tab. Scrub it (fake names, account numbers, references, phone numbers) and add it as a fixture in `src/lib/parsers/parsers.test.ts` before writing the parser. Same for statements in `src/lib/statements/statements.test.ts`.
2. **Bump the version that makes existing sheets pick it up.** `PARSER_VERSION` in `src/gas/main.ts` when a parser learns a new format (emails in Unrecognised are read again). `LAYOUT_VERSION` when a tab's layout, formulas or charts change (Summary and Trends are rebuilt; add a one-off upgrade for anything else).
3. **Before saying it's done:** `pnpm test`, `pnpm typecheck`, `pnpm build`. Commit the rebuilt `apps-script/` with the source; CI fails if they differ.
4. **New OAuth scope?** Only if the human asked. Say in your summary that users must run Set up again, because scheduled syncs stop until they do.
5. **Check it in a real sheet when you can.** Tests run against a fake Sheet; formulas and charts only prove themselves in Google Sheets.
6. **Commit messages** say what changed and why, in plain sentences. One logical change per commit. No attribution lines (see above).
7. **Writing** in the README, docs and report is plain and direct, in the style of https://www.paulgraham.com/goodwriting.html: short sentences, no jargon where a common word works, and say what something does rather than how clever it is.

The report lives in `docs/report/report.tex`. Build it with `tectonic -X compile docs/report/report.tex`; the PDF is git-ignored. Keep each table or figure right after the sentence that refers to it, and use only aggregate numbers, never real transactions.

`.githooks/` enforces most of this locally (`pre-commit`, `commit-msg`, `pre-push`) and `.github/workflows/hygiene.yml` repeats it in CI. `pnpm install` points git at the hooks.

## Commands
- `pnpm test`: vitest (email parsers, statement parsers, matching, and the Apps Script glue against fake Sheets/Gmail)
- `pnpm typecheck`
- `pnpm build`: writes `apps-script/` from `src/gas/`. Commit the result; CI checks it's up to date.
- `pnpm check-statement <pdf>...`: run a real statement through the import code and check that its totals add up
- `pnpm push`: build and `clasp push` to the sheet in `.clasp.json`

## Layout
- `src/lib/parsers/`: one file per bank, alert email text to `ParsedTxn`. Fixtures in `parsers.test.ts`.
- `src/lib/statements/`: statement PDF text lines to transactions plus a balance check per account. `lines.ts` rebuilds lines from pdf.js text positions; parsers rely on indentation to tell description lines from page footers.
- `src/lib/match.ts`: pairs an email alert with its statement line (same amount, within 3 days, a shared merchant word). When unsure, it doesn't merge.
- `src/lib/categorise.ts`: keyword rules, user rules from the Rules tab, own-transfer detection, dedup key
- `src/lib/recurring.ts`: finds subscriptions and other regular payments for the Recurring tab
- `src/lib/ai.ts`: the optional Gemini request; only merchant names, types and descriptions go in
- `src/gas/main.ts`: Apps Script entry points (menu, setup, sync trigger, onEdit, statement import, balances, monthly reminder) and the tabs it builds. `appsscript.json` lists the OAuth scopes.
- `src/gas/import.html` + `import-client.ts`: import dialog; reads the PDF in the browser with pdf.js
- `apps-script/`: build output that users paste into Apps Script
- `.githooks/lib.sh`: the patterns the hooks and CI block
- `docs/report/`: the write-up of what we learned, as LaTeX
