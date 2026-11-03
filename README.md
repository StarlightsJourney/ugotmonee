# ugotmonee

Automatic expense tracking for OCBC and DBS/POSB (including PayLah!) customers in Singapore.

Most expense trackers make you type in every payment, because Singapore banks don't give apps an open way to read your transactions. The ones that link to your bank cover one bank, ask for your bank login, or charge for it. But your bank already emails you when you pay, and sends a statement every month. ugotmonee reads both into a Google Sheet, sorts each payment into a category, and shows where your money went.

There's no app to install, no account to create and no server. It's a Google Sheet with a script attached, and your data stays in your own Google account.

## What you get

- **Transactions**: every payment, added within 5 minutes of the bank's email.
- **Summary** and **Trends**: spending by category and month, your average month, and what you're on pace to spend.
- **Recurring**: subscriptions and other regular payments, with a note when one stops.
- **Accounts**: your balance from the last statement, plus an estimate for today.
- **A reminder email** on the 8th of each month if last month's statement isn't in yet.

## What you need

- A Google account whose Gmail receives your bank's alert emails.
- Bank alerts turned on. In internet banking, under e-Alerts, turn on every kind, and set card alerts to the lowest amount.
- Your monthly statement PDFs.
- Optional: a free [Gemini API key](https://aistudio.google.com/apikey) to sort merchants the built-in list doesn't know.

## Setting it up

About five minutes.

1. Make a Google Sheet at [sheets.new](https://sheets.new) and open **Extensions → Apps Script**.
2. In **Project Settings** (the gear), tick **Show "appsscript.json" manifest file in editor**.
3. Copy in the three files from the [`apps-script`](apps-script) folder:
   - `appsscript.json` replaces the editor's copy.
   - `Code.js` replaces everything in `Code.gs`.
   - `Import.html` goes in a new HTML file named `Import` (**+ → HTML**).
4. Save, reload the Sheet, and click **ugotmonee → Set up**. Google says the app is unverified because you just made it: click **Advanced**, then **Go to ugotmonee**.
5. In the **Settings** tab, type your name the way your bank writes it, such as `JANE TAN, JANE`. Transfers between your own accounts then don't count as spending.
6. Import your statements with **ugotmonee → Import statement (PDF)**.

If the menu doesn't appear or you see *permission denied*, you're signed in to more than one Google account. Open the Sheet in a private window with just one.

## Adding a payment by hand

For a payment that sent no email, such as NETS QR with the OCBC app, type it into a new row at the bottom of **Transactions**: the date, what you bought, and the amount. The rest fills itself in, and it counts straight away. When that month's statement is imported, the same amount within 3 days is matched to your row instead of being added again. Type `in` under Direction for money you received.

## Privacy

- Gmail is read-only, and only mail from OCBC, DBS and PayLah! is searched.
- Statement PDFs are read in your browser and never uploaded.
- Gemini, if you turn it on, sees only merchant names. Never amounts, dates or account numbers.
- The monthly reminder is sent from your account to yourself.

Every permission is listed in [`appsscript.json`](apps-script/appsscript.json). To stop it, delete the trigger under **Extensions → Apps Script → Triggers**, or remove its access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## What it can't see

- Cash.
- Purchases inside other wallets like GrabPay. You'll see the top-up only.
- Payments your alert settings leave out, until you import the statement.
- **NETS QR paid with the OCBC app**, until you import the statement. OCBC doesn't offer an email alert for it. If you also bank with DBS/POSB, scan with PayLah! instead: every PayLah! payment, NETS QR included, sends an email. With OCBC only, paying by PayNow where the QR code allows it also sends one.

## Other solutions

Before building this we looked at what exists, as of November 2026:

- **Your bank's own planner** (DBS NAV Planner, OCBC Financial OneView) sees transactions automatically, but only that bank's.
- **SGFinDex** links banks, CPF and insurers, but gives balances and holdings, not a list of payments.
- **Multi-bank apps** such as Dobin, MySprout and Spendee can link DBS and OCBC, but ask for your bank login or a paid plan. Seedly, a popular one, shut down at the end of 2025.
- **Email-forwarding services** such as Graiden read your bank alerts, but on their servers.
- **Open-source projects** come closest. [lanbau/spend-tracker](https://github.com/lanbau/spend-tracker) also uses Apps Script and Gmail but reads PayLah! only. Others read DBS alerts into a self-hosted app ([legitaxes/expense-tracker](https://github.com/legitaxes/expense-tracker)), export PayLah! emails to CSV ([MarkHershey/gmail-paylah](https://github.com/MarkHershey/gmail-paylah)), or work from bank exports ([pebblepaw/OpenExpense](https://github.com/pebblepaw/OpenExpense)).

None we found read both OCBC and DBS/POSB, combine the emails with the statements, and keep everything in your own Google account. That's the gap this fills.

## How well it works

[The report](docs/report/report.tex) measures it on real accounts. With the alerts that were on at the time, emails showed 51% of the money spent but only 27% of the payments. Turning on every kind of alert closes most of that gap. Build the PDF with `tectonic -X compile docs/report/report.tex`.

## Working on it

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` writes `apps-script/` from `src/`. To push to your own Sheet instead of copy-pasting, turn on the Apps Script API at [script.google.com/home/usersettings](https://script.google.com/home/usersettings), then:

```bash
pnpm dlx @google/clasp@3 login
pnpm dlx @google/clasp@3 create --type sheets --title ugotmonee --rootDir apps-script
pnpm push
```

To check a parser against a real statement without committing it, run `pnpm check-statement ~/Downloads/statement.pdf`. It prints only whether the totals add up.

To add a bank or email format, start from a real example with every name, account number and reference replaced by fake ones, and add it as a test. [AGENTS.md](AGENTS.md) has the full rules. `pnpm install` turns on git hooks that block secrets, personal data and statement files.

## Licence

MIT. See [LICENSE](LICENSE).
