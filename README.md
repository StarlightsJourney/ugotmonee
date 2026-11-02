# ugotmonee

Your bank already emails you when you spend money, and sends a statement every month. ugotmonee reads both into a Google Sheet, sorts each payment into a category, and shows where your money went.

It's a Google Sheet with a script attached. There's no app to install, no account to create, and no server. Your data stays in your own Google account.

It reads Singapore banks for now: OCBC and DBS/POSB, including PayLah!.

## How it works

Every 5 minutes the script searches your Gmail for bank alerts and adds each payment to the Transactions tab. When you first set it up, it reads the last 6 months.

Not everything sends an alert. NETS QR payments and some card payments only show up on your monthly statement. So once a month you import the statement PDF. Payments you already had from emails are matched up, not added twice. The import checks that the opening balance, minus what went out, plus what came in, equals the closing balance. If it doesn't, it tells you something was missed.

If you change a payment's category, the sheet remembers that merchant and uses your category from then on.

The Summary tab shows one month by category. The Trends tab shows the last 12 months: what came in and went out each month, your average month, what you're on pace to spend this month, top merchants, and spending by category and day of the week.

The Accounts tab keeps each account's balance from its latest statement, which is exact, and an estimate of the balance now, which adds the alerts since then. On the 8th of each month the script emails you if last month's statements haven't been imported.

## Categorising with Gemini (optional)

Keyword rules know common merchants. For the rest you can let Gemini guess. Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and paste it into **ugotmonee → Categorise with Gemini…**.

Only the names of uncategorised merchants are sent, with the payment type. Never amounts, dates or account numbers. Each merchant is asked about once, and the answer is saved in the Rules tab, where you can change it. On Gemini's free tier, Google may use what you send to improve its products. The key is kept in the script's private storage for your Google account, not in the sheet. To turn it off, open the same menu and leave the key blank.

## What it can't see

- Cash.
- What you spend inside other wallets like GrabPay. You'll see the top-up, not the purchases.
- Card payments, until the statement arrives, unless you turn on card alerts. In OCBC Internet Banking, go to Customer Service, then Manage e-Alerts, and set card alerts to $0.

## Setting it up

You need a Google account that receives your bank alerts in Gmail. Setup takes about five minutes.

1. Make a new Google Sheet at [sheets.new](https://sheets.new).
2. Open **Extensions → Apps Script**.
3. Click the gear icon (Project Settings) and tick **Show "appsscript.json" manifest file in editor**.
4. Back in the editor, copy three files from the [`apps-script`](apps-script) folder:
   - `appsscript.json`: replace what's in the editor's copy.
   - `Code.js`: replace everything in `Code.gs`.
   - `Import.html`: add an HTML file named `Import` with **+ → HTML**, and paste it in.
5. Save. Go back to the sheet and reload it. A **ugotmonee** menu appears.
6. Click **ugotmonee → Set up**. Google asks you to allow access. It warns that the app isn't verified, because it's a script you just made yourself. Click **Advanced**, then **Go to ugotmonee**.
7. In the Settings tab, type the names your bank uses for you, such as `JANE TAN, JANE`. Payments between your own accounts then aren't counted as spending.

To import a statement, download the PDF from your bank and click **ugotmonee → Import statement (PDF)**.

## What it has access to

The script asks for these permissions, all listed in `appsscript.json`:

- read your Gmail (read-only: it can't delete or change anything)
- edit this one spreadsheet
- run itself every 5 minutes, and monthly for the reminder
- show its menu and import window
- send email as you, and see your address: only to email you the monthly reminder
- connect to an external service: only Gemini, and only if you give it a key

It searches Gmail only for mail from `ocbc.com`, `dbs.com` and PayLah!.

Statement PDFs are read in your browser by [pdf.js](https://mozilla.github.io/pdf.js/). It loads from cdnjs, pinned to one version and checked against a hash. The PDF itself isn't uploaded anywhere. Only the lines of text go to your script, which runs on Google's servers like any Apps Script.

The code is short. Read `apps-script/Code.js` before you paste it in. That file is built from `src/`.

To stop it, open **Extensions → Apps Script → Triggers** and delete the trigger. To remove its access, go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Working on it

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` writes `apps-script/` from `src/`. To push straight to your own sheet instead of copy-pasting, use [clasp](https://github.com/google/clasp). First turn on the Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings), then:

```bash
pnpm dlx @google/clasp@3 login
pnpm dlx @google/clasp@3 create --type sheets --title ugotmonee --rootDir apps-script
pnpm push
```

To check a statement parser against a real PDF without committing it:

```bash
pnpm check-statement ~/Downloads/statement.pdf
```

It prints only whether the totals add up. Add `--show` to list the transactions on your screen.

To add a bank, write a parser in `src/lib/parsers/` for its alert emails or `src/lib/statements/` for its statements, and add a test with every name, account number and reference replaced by fake ones. `pnpm install` turns on git hooks that block secrets, personal data, statement files, and AI agents credited as authors.

## Licence

MIT. See [LICENSE](LICENSE).
