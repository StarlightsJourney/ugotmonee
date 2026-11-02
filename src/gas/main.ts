// Runs inside Google Apps Script, bound to the user's own Sheet.
// Everything stays in their Google account: Gmail is read, the Sheet is written. The one exception is
// opt-in: with a Gemini key set, names of uncategorised merchants go to Gemini (see ../lib/ai.ts).
import { GEMINI_MODELS, geminiRequest, geminiUrl, parseGeminiReply, type Payee } from "../lib/ai";
import { DEFAULT_CATEGORIES, SUBSCRIPTION, categorise, dedupKey, isOwnName, normaliseMerchant, type UserRule } from "../lib/categorise";
import { findMatch, isGeneric, type Candidate } from "../lib/match";
import { findRecurring, type Spend } from "../lib/recurring";
import { parseEmail, type ParsedTxn, type RawEmail } from "../lib/parsers";
import { htmlToText } from "../lib/parsers/util";
import { parseStatement, type AccountCheck } from "../lib/statements";

const TX = "Transactions";
const SUMMARY = "Summary";
const RULES = "Rules";
const SETTINGS = "Settings";
const UNRECOGNISED = "Unrecognised";
const ACCOUNTS = "Accounts";
const TRENDS = "Trends";
const RECURRING = "Recurring";

const HEADERS = [
  "Date",
  "Merchant",
  "Amount",
  "Currency",
  "Direction",
  "Category",
  "Account",
  "Type",
  "Description",
  "Source",
  "Reference",
  "Merchant key",
  "Key",
  "Statement key",
] as const;
const C = Object.fromEntries(HEADERS.map((h, i) => [h, i])) as Record<(typeof HEADERS)[number], number>;

/** Alerts come from these banks. The parsers decide what's a transaction. */
const QUERY = '(from:ocbc.com OR from:dbs.com OR "We refer to your PayLah!")';
const BACKFILL_DAYS = 365;
/** Bump when a parser learns a new email format, so emails in Unrecognised get another go. */
const PARSER_VERSION = 4;
const DAY = 86_400_000;
/** Apps Script stops a run at 6 minutes. Reading stops here, leaving room to write what was read and run Gemini. */
const TIME_BUDGET = 3 * 60_000;
/** An email mentioning an amount that no parser understood: worth showing the user. */
const MONEY = /\b(?:SGD|USD|S\$)\s?[\d,]+\.\d{2}\b/;

type Row = unknown[];
type Origin = "email" | "statement";
interface Entry {
  txn: ParsedTxn;
  key: string;
  stmtKey?: string;
}

const book = () => SpreadsheetApp.getActiveSpreadsheet();

function ensureSheet(name: string, headers: readonly string[]) {
  let s = book().getSheetByName(name);
  if (!s) {
    s = book().insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([[...headers]]).setFontWeight("bold");
    s.setFrozenRows(1);
  }
  return s;
}

function ensureSheets() {
  const fresh = !book().getSheetByName(TX);
  const tx = ensureSheet(TX, HEADERS);
  if (fresh) {
    tx.getRange("A2:A").setNumberFormat("yyyy-mm-dd hh:mm");
    tx.getRange("C2:C").setNumberFormat("#,##0.00");
    categoryDropdown(tx);
    tx.hideColumns(C["Merchant key"] + 1, 3);
    tx.setColumnWidth(C.Merchant + 1, 220);
    tx.setColumnWidth(C.Description + 1, 280);
  }
  const rules = ensureSheet(RULES, ["Merchant key", "Category", "Set by"]);
  if (!rules.getRange(1, 3).getValue()) rules.getRange(1, 3).setValue("Set by").setFontWeight("bold");
  ensureSheet(UNRECOGNISED, ["Received", "From", "Subject", "Message ID", "Text"]);
  if (!book().getSheetByName(ACCOUNTS)) {
    const a = ensureSheet(ACCOUNTS, [...ACCOUNT_HEADERS]);
    a.getRange("B2:B").setNumberFormat("#,##0.00");
    a.getRange("D2:D").setNumberFormat("#,##0.00");
    a.setColumnWidth(1, 240);
  }
  if (!book().getSheetByName(SETTINGS)) {
    ensureSheet(SETTINGS, ["Setting", "Value"])
      .getRange(2, 1, 1, 2)
      .setValues([["Your names on statements (comma-separated), so transfers to yourself aren't counted as spending", ""]]);
  }
  const settings = book().getSheetByName(SETTINGS)!;
  if (!settings.getRange(4, 1).getValue()) settings.getRange(4, 1).setValue(PAYLAH_SETTING);
  upgradeLayout(tx);
}

/** Bump when the Summary or Transactions formatting changes, so existing sheets pick it up on their next sync. */
const LAYOUT_VERSION = 8;

function upgradeLayout(tx: GoogleAppsScript.Spreadsheet.Sheet) {
  const props = PropertiesService.getScriptProperties();
  const current = Number(props.getProperty("layout")) || 0;
  if (current >= LAYOUT_VERSION && book().getSheetByName(SUMMARY) && book().getSheetByName(TRENDS)) return;
  // Summary and Trends hold only formulas, so they're safe to rebuild
  for (const name of [SUMMARY, TRENDS]) {
    const old = book().getSheetByName(name);
    if (old) book().deleteSheet(old);
  }
  buildSummary();
  buildTrends();
  if (current < 2) colourDirections(tx);
  if (current < 6) upgradeAccounts();
  if (current < 8) moveSubscriptions(tx);
  props.setProperty("layout", String(LAYOUT_VERSION));
}

function categoryDropdown(tx: GoogleAppsScript.Spreadsheet.Sheet) {
  tx.getRange("F2:F").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([...DEFAULT_CATEGORIES], true).setAllowInvalid(true).build());
}

/**
 * Subscriptions became a category after these rows were written. A category you chose stays;
 * Gemini's guesses (Set by: Gemini in Rules) are moved too, so future payments follow.
 */
function moveSubscriptions(tx: GoogleAppsScript.Spreadsheet.Sheet) {
  categoryDropdown(tx);
  const rules = book().getSheetByName(RULES)!;
  const ruleRows = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 3).getValues() : [];
  const chosen = new Set(ruleRows.filter((r) => r[2] !== "Gemini").map((r) => String(r[0])));
  ruleRows.forEach((r, i) => {
    if (r[2] === "Gemini" && SUBSCRIPTION.test(String(r[0]))) rules.getRange(i + 2, 2).setValue("Subscriptions");
  });
  const n = tx.getLastRow() - 1;
  if (n < 1) return;
  const rows = tx.getRange(2, 1, n, HEADERS.length).getValues();
  const cats = rows.map((r) => {
    const guessed = ["Entertainment", "Uncategorised"].includes(String(r[C.Category])) && !chosen.has(String(r[C["Merchant key"]]));
    return [guessed && r[C.Direction] === "out" && SUBSCRIPTION.test(`${r[C.Merchant]} ${r[C.Description]}`) ? "Subscriptions" : r[C.Category]];
  });
  tx.getRange(2, C.Category + 1, n, 1).setValues(cats);
}

/** Money in green, money out red. Added alongside any rules the user made. */
function colourDirections(tx: GoogleAppsScript.Spreadsheet.Sheet) {
  const rule = (direction: string, font: string, fill: string) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$E2="${direction}"`)
      .setFontColor(font)
      .setBackground(fill)
      .setRanges([tx.getRange("C2:C"), tx.getRange("E2:E")])
      .build();
  tx.setConditionalFormatRules([...tx.getConditionalFormatRules(), rule("in", "#137333", "#e6f4ea"), rule("out", "#a50e0e", "#fce8e6")]);
}

function buildSummary() {
  const s = book().insertSheet(SUMMARY, 0);
  const t = `'${TX}'`;
  const from = `TEXT(B1,"yyyy-mm-dd")`;
  const to = `TEXT(EDATE(B1,1),"yyyy-mm-dd")`;
  // First day of each month that has transactions, newest first: the B1 dropdown and the by-month table use it
  const months = `ARRAYFORMULA(IF(${t}!A2:A="",,EOMONTH(${t}!A2:A,-1)+1))`;

  s.getRange("Z1").setValue("Months");
  s.getRange("Z2").setFormula(`=SORT(UNIQUE(FILTER(${months},${months}<>"")),1,FALSE)`);
  s.getRange("Z2:Z").setNumberFormat("mmm yyyy");
  s.hideColumns(26);

  s.getRange("A1").setValue("Month");
  // Starts on the latest month with transactions; pick another from the dropdown
  s.getRange("B1")
    .setFormula(`=IF(COUNT(${t}!A2:A),EOMONTH(MAX(${t}!A2:A),-1)+1,DATE(YEAR(TODAY()),MONTH(TODAY()),1))`)
    .setNumberFormat("mmm yyyy")
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(s.getRange("Z2:Z"), true).setAllowInvalid(true).build());
  s.getRange("D1").setValue("Spent");
  s.getRange("E1")
    .setFormula(`=SUMIFS(${t}!C:C,${t}!E:E,"out",${t}!F:F,"<>Own transfers",${t}!A:A,">="&B1,${t}!A:A,"<"&EDATE(B1,1))`)
    .setNumberFormat("#,##0.00");
  s.getRange("A3").setFormula(
    `=QUERY(${t}!A:F,"select F, sum(C) where E = 'out' and F <> 'Own transfers' and A >= datetime '"&${from}&" 00:00:00' and A < datetime '"&${to}&" 00:00:00' group by F order by sum(C) desc label F 'Category', sum(C) 'Spent'",1)`,
  );
  s.getRange("B4:B20").setNumberFormat("#,##0.00");
  s.insertChart(s.newChart().setChartType(Charts.ChartType.PIE).setNumHeaders(1).addRange(s.getRange("A3:B20")).setPosition(3, 4, 0, 0).build());

  s.getRange("A23").setValue("By month");
  s.getRange("A24").setFormula(
    `=QUERY({${months},${t}!C2:C,${t}!E2:E,${t}!F2:F},"select Col1, sum(Col2) where Col1 is not null and Col4 <> 'Own transfers' group by Col1 pivot Col3 order by Col1 desc label Col1 'Month'",0)`,
  );
  s.getRange("A25:A60").setNumberFormat("mmm yyyy");
  s.getRange("B25:C60").setNumberFormat("#,##0.00");
  s.getRange("G1").setValue("Balance (est.)");
  s.getRange("H1").setFormula(`=SUM('${ACCOUNTS}'!D2:D)`).setNumberFormat("#,##0.00");
  s.getRange("A1:H1").setFontWeight("bold");
  s.getRange("A23").setFontWeight("bold");
}

function buildTrends() {
  const s = book().insertSheet(TRENDS, 1);
  const t = `'${TX}'`;
  const thisMonth = "(EOMONTH(TODAY(),-1)+1)";
  const total = (dir: string, from: string, to: string) =>
    `SUMIFS(${t}!C:C,${t}!E:E,"${dir}",${t}!F:F,"<>Own transfers",${t}!A:A,">="&${from},${t}!A:A,"<"&${to})`;
  // Spending rows, for FILTER
  const spend = `${t}!E2:E="out",${t}!F2:F<>"Own transfers"`;
  const earliest = `MIN(${t}!A2:A)`;
  // The first month with data is usually partial (emails go back 180 days from setup), so it isn't averaged
  const firstFull = `IF(DAY(${earliest})=1,EOMONTH(${earliest},-1)+1,EOMONTH(${earliest},0)+1)`;
  const avgFrom = `EDATE(${thisMonth},-B8)`;

  s.getRange("A1").setValue("Trends").setFontWeight("bold");
  s.getRange("A2").setValue(
    "Leaves out transfers between your own accounts. A month without its statement imported misses NETS QR and card payments, so it reads low.",
  );
  s.getRange("A4:B12").setValues([
    ["Spent this month", ""],
    ["Per day this month", ""],
    ["On pace for", ""],
    ["", ""],
    ["Full months averaged (up to 3)", ""],
    ["Average spent per month", ""],
    ["Average spent per day", ""],
    ["Average money in per month", ""],
    ["Average left over per month", ""],
  ]);
  s.getRange("B4").setFormula(`=${total("out", thisMonth, `EDATE(${thisMonth},1)`)}`);
  s.getRange("B5").setFormula(`=B4/DAY(TODAY())`);
  s.getRange("B6").setFormula(`=B5*DAY(EOMONTH(TODAY(),0))`);
  s.getRange("B8").setFormula(`=IF(COUNT(${t}!A2:A),MAX(0,MIN(3,DATEDIF(${firstFull},${thisMonth},"M"))),0)`);
  s.getRange("B9").setFormula(`=IF(B8,${total("out", avgFrom, thisMonth)}/B8,"Not enough data")`);
  s.getRange("B10").setFormula(`=IF(B8,${total("out", avgFrom, thisMonth)}/(${thisMonth}-${avgFrom}),"")`);
  s.getRange("B11").setFormula(`=IF(B8,${total("in", avgFrom, thisMonth)}/B8,"")`);
  s.getRange("B12").setFormula(`=IF(B8,B11-B9,"")`);
  s.getRange("B4:B12").setNumberFormat("#,##0.00");
  s.getRange("B8").setNumberFormat("0");

  // Last 12 months, or since the first transaction
  const start = `MAX(EDATE(${thisMonth},-11),EOMONTH(${earliest},-1)+1)`;
  const m = "A15:A26";
  s.getRange("A14:C14").setValues([["Month", "Money in", "Spent"]]).setFontWeight("bold");
  s.getRange("A15").setFormula(`=IF(COUNT(${t}!A2:A),ARRAYFORMULA(EDATE(${start},SEQUENCE(DATEDIF(${start},${thisMonth},"M")+1,1,0))),)`);
  // SUMIFS doesn't spread over a range of months inside ARRAYFORMULA; MAP runs it once per month
  s.getRange("B15").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${total("in", "x", "EDATE(x,1)")})))`);
  s.getRange("C15").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${total("out", "x", "EDATE(x,1)")})))`);
  s.getRange(m).setNumberFormat("mmm yyyy");
  s.getRange("B15:C26").setNumberFormat("#,##0.00");

  s.getRange("A29").setValue("Top merchants, last 90 days").setFontWeight("bold");
  s.getRange("A30").setFormula(
    `=IFERROR(QUERY(FILTER({${t}!B2:B,${t}!C2:C},${spend},${t}!A2:A>=TODAY()-90),"select Col1, count(Col2), sum(Col2) group by Col1 order by sum(Col2) desc limit 15 label Col1 'Merchant', count(Col2) 'Times', sum(Col2) 'Spent'",0),"Nothing yet")`,
  );
  s.getRange("C31:C45").setNumberFormat("#,##0.00");

  s.getRange("A48").setValue("By day of the week").setFontWeight("bold");
  s.getRange("A49:C49").setValues([["Day", "Spent", "Average per day"]]).setFontWeight("bold");
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day, i) => {
    const r = 50 + i;
    const isDay = `(WEEKDAY(${t}!A2:A,2)=${i + 1})`;
    s.getRange(r, 1).setValue(day);
    s.getRange(r, 2).setFormula(`=SUMPRODUCT((${t}!E2:E="out")*(${t}!F2:F<>"Own transfers")*${isDay}*${t}!C2:C)`);
    // Spread over how many of that weekday the data covers
    s.getRange(r, 3).setFormula(
      `=IF(COUNT(${t}!A2:A),B${r}/MAX(1,SUMPRODUCT(--(WEEKDAY(SEQUENCE(INT(MAX(${t}!A2:A))-INT(MIN(${t}!A2:A))+1,1,INT(MIN(${t}!A2:A))),2)=${i + 1}))),)`,
    );
  });
  s.getRange("B50:C56").setNumberFormat("#,##0.00");

  s.getRange("A60").setValue("Categories by month").setFontWeight("bold");
  s.getRange("A61").setFormula(
    `=IFERROR(QUERY(FILTER({ARRAYFORMULA(EOMONTH(${t}!A2:A,-1)+1),${t}!C2:C,${t}!F2:F},${spend},${t}!A2:A>=EDATE(${thisMonth},-11)),"select Col1, sum(Col2) group by Col1 pivot Col3 order by Col1 label Col1 'Month'",0),"Nothing yet")`,
  );
  s.getRange("A62:A73").setNumberFormat("mmm yyyy");
  s.getRange("B62:P73").setNumberFormat("#,##0.00");
  s.setColumnWidth(1, 220);

  const chart = (type: GoogleAppsScript.Charts.ChartType, row: number, title: string, ranges: string[]) => {
    let b = s.newChart().setChartType(type).setNumHeaders(1).setPosition(row, 5, 0, 0).setOption("title", title).setOption("legend", { position: "bottom" });
    for (const r of ranges) b = b.addRange(s.getRange(r));
    return b;
  };
  s.insertChart(chart(Charts.ChartType.COLUMN, 4, "Money in and spent by month", ["A14:C26"]).setOption("colors", ["#137333", "#c5221f"]).build());
  s.insertChart(chart(Charts.ChartType.COLUMN, 24, "Spending by category", ["A61:P73"]).setOption("isStacked", true).build());
  s.insertChart(chart(Charts.ChartType.BAR, 44, "Top merchants, last 90 days", ["A30:A45", "C30:C45"]).setOption("legend", { position: "none" }).build());
}

// ---- reading and writing transactions ----

function context() {
  const rules = book().getSheetByName(RULES)!;
  const userRules: UserRule[] = rules.getLastRow() > 1
    ? rules.getRange(2, 1, rules.getLastRow() - 1, 2).getValues().map((r) => ({ merchantKey: String(r[0]), category: String(r[1]) }))
    : [];
  const ownNames = String(book().getSheetByName(SETTINGS)!.getRange("B2").getValue() ?? "").split(",");
  return { userRules, ownNames };
}

function loadTransactions() {
  const sheet = book().getSheetByName(TX)!;
  const n = sheet.getLastRow() - 1;
  const rows: Row[] = n > 0 ? sheet.getRange(2, 1, n, HEADERS.length).getValues() : [];
  const keys = new Set(rows.flatMap((r) => [r[C.Key], r[C["Statement key"]]]).filter(Boolean).map(String));
  return { sheet, rows, keys };
}

function candidates(rows: Row[], source: Origin): Candidate[] {
  const out: Candidate[] = [];
  rows.forEach((r, id) => {
    if (r[C.Source] !== source) return;
    out.push({
      id,
      at: (r[C.Date] as Date).getTime(),
      amountCents: Math.round(Number(r[C.Amount]) * 100),
      direction: r[C.Direction] === "out" ? "debit" : "credit",
      merchantKey: String(r[C["Merchant key"]]),
      account: String(r[C.Account]),
    });
  });
  return out;
}

function toRow(e: Entry, category: string, origin: Origin): Row {
  const t = e.txn;
  const row: Row = [];
  row[C.Date] = new Date(t.occurredAt);
  row[C.Merchant] = t.merchant;
  row[C.Amount] = t.amountCents / 100;
  row[C.Currency] = t.currency;
  row[C.Direction] = t.direction === "debit" ? "out" : "in";
  row[C.Category] = category;
  row[C.Account] = t.account;
  row[C.Type] = t.kind;
  row[C.Description] = t.description ?? "";
  row[C.Source] = origin;
  row[C.Reference] = t.reference ?? "";
  row[C["Merchant key"]] = normaliseMerchant(t.merchant);
  row[C.Key] = e.key;
  row[C["Statement key"]] = e.stmtKey ?? "";
  return row;
}

/**
 * Add transactions, skipping ones already recorded and merging an email alert
 * with its statement line (whichever arrives second) into one row.
 */
function record(entries: Entry[], origin: Origin) {
  const { sheet, rows, keys } = loadTransactions();
  const { userRules, ownNames } = context();
  const other = candidates(rows, origin === "email" ? "statement" : "email");
  const used = new Set<number>();
  const added: Row[] = [];
  let matched = 0;
  let skipped = 0;

  for (const e of entries) {
    if (keys.has(e.key)) {
      skipped++;
      continue;
    }
    keys.add(e.key);
    const t = e.txn;
    const m = findMatch(
      { at: Date.parse(t.occurredAt), amountCents: t.amountCents, direction: t.direction, merchantKey: normaliseMerchant(t.merchant), account: t.account },
      other,
      used,
    );
    if (m) {
      used.add(m.id);
      const row = rows[m.id];
      row[C.Source] = "both";
      if (origin === "email") {
        // The alert has the exact time and reference; the statement only had the date.
        row[C.Date] = new Date(t.occurredAt);
        row[C.Reference] = t.reference ?? "";
        row[C.Key] = e.key;
        // The statement said only "FAST Payment / Receipt"; the alert knows who it was
        if (isGeneric(String(row[C["Merchant key"]]))) {
          row[C.Merchant] = t.merchant;
          row[C["Merchant key"]] = normaliseMerchant(t.merchant);
          row[C.Category] = categorise(t, userRules, ownNames);
        }
      } else {
        row[C["Statement key"]] = e.stmtKey ?? "";
      }
      matched++;
      continue;
    }
    added.push(toRow(e, categorise(t, userRules, ownNames), origin));
  }

  // One write for all merged rows; one cell at a time is slow with hundreds
  if (matched) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  if (added.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, added.length, HEADERS.length).setValues(added);
    sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).sort({ column: C.Date + 1, ascending: false });
  }
  return { added: added.length, matched, skipped };
}

// ---- recurring payments ----

/** Rewrite the Recurring tab from the transactions. It holds no input of yours, so it's safe to replace. */
function buildRecurring() {
  const { rows } = loadTransactions();
  const spends: Spend[] = [];
  let coveredUntil = 0;
  for (const r of rows) {
    const date = r[C.Date];
    if (!(date instanceof Date)) continue;
    const at = date.getTime();
    if (r[C.Source] !== "email") coveredUntil = Math.max(coveredUntil, at + DAY);
    if (r[C.Direction] !== "out" || r[C.Category] === "Own transfers") continue;
    spends.push({ at, merchant: String(r[C.Merchant]), merchantKey: String(r[C["Merchant key"]]), amount: Number(r[C.Amount]), category: String(r[C.Category]) });
  }
  const found = findRecurring(spends, Date.now(), coveredUntil);

  // Cleared rather than replaced, so it doesn't jump away while you're looking at it
  const s = book().getSheetByName(RECURRING) ?? book().insertSheet(RECURRING, 2);
  s.clearContents();
  const headers = ["Merchant", "Kind", "Category", "Usual amount", "Every", "Times", "Last paid", "Next expected", "Per month", "Note"];
  s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  s.setFrozenRows(1);
  s.setColumnWidth(1, 220);
  const date = (ms: number | null) => (ms ? new Date(ms) : "");
  const out = found.map((f) => [
    f.merchant,
    f.kind,
    f.category,
    f.amount,
    f.every,
    f.times,
    date(f.last),
    date(f.nextExpected),
    f.perMonth,
    f.overdue ? `Not in your statements since ${ymd(new Date(f.last))}: cancelled, or paid another way?` : "",
  ]);
  if (out.length) s.getRange(2, 1, out.length, headers.length).setValues(out);
  s.getRange("D2:D").setNumberFormat("#,##0.00");
  s.getRange("I2:I").setNumberFormat("#,##0.00");
  s.getRange("G2:H").setNumberFormat("yyyy-mm-dd");
  const subs = found.filter((f) => f.kind === "Subscription" && !f.overdue).reduce((a, f) => a + f.perMonth, 0);
  const all = found.filter((f) => !f.overdue).reduce((a, f) => a + f.perMonth, 0);
  s.getRange("L1:M3").setValues([
    ["Subscriptions per month", subs],
    ["All recurring per month", all],
    ["Found from repeat payments of about the same amount at a steady interval, plus known subscription services.", ""],
  ]);
  s.getRange("M1:M2").setNumberFormat("#,##0.00");
}

// ---- Gmail ----

type Part = GoogleAppsScript.Gmail.Schema.MessagePart;

/**
 * The advanced Gmail service hands body data back as bytes already decoded,
 * though the type says base64url string. Accept either.
 */
function decode(data?: string | number[] | null) {
  if (!data || !data.length) return "";
  const bytes = typeof data === "string" ? Utilities.base64DecodeWebSafe(data.padEnd(Math.ceil(data.length / 4) * 4, "=")) : data;
  return Utilities.newBlob(bytes).getDataAsString("UTF-8");
}

function findBody(part: Part | undefined, mime: string): string {
  if (!part) return "";
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data as string | number[]);
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime);
    if (found) return found;
  }
  return "";
}

function toRawEmail(msg: GoogleAppsScript.Gmail.Schema.Message): RawEmail {
  const header = (name: string) => msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name)?.value ?? undefined;
  const plain = findBody(msg.payload, "text/plain").trim();
  return {
    from: header("from"),
    subject: header("subject"),
    text: plain || htmlToText(findBody(msg.payload, "text/html")),
    receivedAt: new Date(Number(msg.internalDate)),
  };
}

/** Read new bank alerts from Gmail into the sheet. Runs every 5 minutes after setup. */
export function sync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10_000)) return { added: 0, matched: 0, skipped: 0, more: true };
  try {
    ensureSheets();
    const started = Date.now();
    const props = PropertiesService.getScriptProperties();
    let cursor = Number(props.getProperty("cursor")) || started - BACKFILL_DAYS * DAY;
    // Sheets set up when this read 180 days go back once more, to match a year of statements
    if (props.getProperty("backfill") !== String(BACKFILL_DAYS)) {
      cursor = Math.min(cursor, started - BACKFILL_DAYS * DAY);
      props.setProperty("backfill", String(BACKFILL_DAYS));
    }
    // An hour's overlap so nothing slips between runs; keys stop doubles.
    const q = `${QUERY} after:${Math.floor(cursor / 1000) - 3600}`;

    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = Gmail!.Users!.Messages!.list("me", { q, maxResults: 500, pageToken });
      for (const m of page.messages ?? []) ids.push(m.id!);
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    ids.reverse(); // oldest first, so the cursor only moves forward

    const unrecognised = book().getSheetByName(UNRECOGNISED)!;
    const oldRows: Row[] = unrecognised.getLastRow() > 1 ? unrecognised.getRange(2, 1, unrecognised.getLastRow() - 1, 5).getValues() : [];
    const seen = new Set(oldRows.map((r) => String(r[3])));
    // Parsers changed: read the unrecognised emails again, ahead of new ones
    const retry = props.getProperty("parsers") !== String(PARSER_VERSION);
    if (retry) {
      const fresh = new Set(ids);
      ids.unshift(...oldRows.map((r) => String(r[3])).filter((id) => id && !fresh.has(id)));
      seen.clear();
    }
    const done = new Set<string>();
    const entries: Entry[] = [];
    const unknown: Row[] = [];
    let last = cursor;
    let more = false;

    for (const id of ids) {
      if (Date.now() - started > TIME_BUDGET) {
        more = true;
        break;
      }
      let email: RawEmail;
      try {
        email = toRawEmail(Gmail!.Users!.Messages!.get("me", id, { format: "full" }));
      } catch (err) {
        // Gmail's per-minute limit: stop here, and the next run carries on from this email
        if (/quota|rate limit/i.test(String(err))) {
          more = true;
          break;
        }
        done.add(id);
        // One unreadable email shouldn't stop the rest; show it so it can be looked at
        if (!seen.has(id)) unknown.push([new Date(), "", "", id, `Couldn't read this email: ${err}`]);
        continue;
      }
      done.add(id);
      last = Math.max(last, email.receivedAt.getTime());
      const r = parseEmail(email);
      if (r.status === "parsed") entries.push({ txn: r.txn, key: dedupKey(r.txn) });
      else if (r.status === "unrecognised" && MONEY.test(email.text) && !seen.has(id))
        unknown.push([email.receivedAt, email.from ?? "", email.subject ?? "", id, email.text.slice(0, 2000)]);
    }

    const result = record(entries, "email");
    if (retry) {
      // Keep what's still unreadable, plus anything the time budget didn't reach
      const keep = [...oldRows.filter((r) => !done.has(String(r[3]))), ...unknown];
      if (oldRows.length) unrecognised.deleteRows(2, oldRows.length);
      if (keep.length) unrecognised.getRange(2, 1, keep.length, 5).setValues(keep);
      if (!more) props.setProperty("parsers", String(PARSER_VERSION));
    } else if (unknown.length) unrecognised.getRange(unrecognised.getLastRow() + 1, 1, unknown.length, 5).setValues(unknown);
    props.setProperty("cursor", String(last));
    buildRecurring();
    if (Date.now() - started < TIME_BUDGET + 60_000) aiCategorise();
    setSyncStatus(`OK. ${result.added} new, ${result.matched} matched, ${result.skipped} already had${more ? ", more still loading" : ""}.`);
    return { ...result, more };
  } catch (err) {
    // Triggers fail silently; this is the one place you (or anyone helping) can see why
    setSyncStatus(`Failed: ${err instanceof Error ? err.stack ?? err.message : err}`.slice(0, 1000));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function setSyncStatus(text: string) {
  try {
    const stamp = Utilities.formatDate(new Date(), "Asia/Singapore", "yyyy-MM-dd HH:mm");
    book().getSheetByName(SETTINGS)?.getRange(5, 1, 1, 2).setValues([["Last sync", `${stamp} ${text}`]]);
  } catch {}
}

// ---- menu, setup, editing ----

export function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("ugotmonee")
    .addItem("Set up", "setup")
    .addItem("Sync emails now", "syncNow")
    .addItem("Import statement (PDF)…", "showImport")
    .addItem("Update balance…", "updateBalances")
    .addSeparator()
    .addItem("Categorise with Gemini…", "setGeminiKey")
    .addToUi();
}

export function setup() {
  book().setSpreadsheetTimeZone("Asia/Singapore");
  ensureSheets();
  for (const t of ScriptApp.getProjectTriggers())
    if (["sync", "remindStatements"].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(5).create();
  // Banks publish last month's statement in the first week
  ScriptApp.newTrigger("remindStatements").timeBased().onMonthDay(8).atHour(9).create();
  const r = sync();
  const message =
    `Done. Found ${r.added} transactions in the last ${BACKFILL_DAYS} days of bank emails.` +
    (r.more ? " There are more; they'll keep loading every 5 minutes." : "") +
    "\n\nNew alerts are checked every 5 minutes. Change a category and future payments to that merchant follow it." +
    " On the 8th of each month you'll get an email if last month's statements haven't been imported.";
  // Run from the script editor there's no sheet UI to show a dialog in; the editor's log shows it instead.
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch {
    console.log(message);
  }
}

export function syncNow() {
  const r = sync();
  book().toast(`${r.added} new, ${r.matched} matched to statement lines.${r.more ? " More still loading." : ""}`, "ugotmonee");
}

/** Changing a category teaches the sheet that merchant. */
export function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() === SETTINGS && range.getRow() === 2 && range.getColumn() === 2) return markOwnTransfers();
  if (sheet.getName() !== TX || range.getColumn() !== C.Category + 1 || range.getNumRows() !== 1 || range.getRow() < 2) return;
  const category = String(e.value ?? "").trim();
  const key = String(sheet.getRange(range.getRow(), C["Merchant key"] + 1).getValue());
  if (!category || !key) return;

  const learned = new Map([[key, category]]);
  saveRules(learned, "you");
  fillCategories(learned);
}

/** After your names change in Settings: transfers already recorded to or from you stop counting as spending or income. */
function markOwnTransfers() {
  const { ownNames } = context();
  const sheet = book().getSheetByName(TX)!;
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const guessed = ["Transfers", "Income", "Uncategorised"];
  const cats = sheet
    .getRange(2, 1, n, HEADERS.length)
    .getValues()
    .map((r) => [guessed.includes(String(r[C.Category])) && isOwnName(String(r[C.Merchant]), ownNames) ? "Own transfers" : r[C.Category]]);
  sheet.getRange(2, C.Category + 1, n, 1).setValues(cats);
}

function saveRules(learned: Map<string, string>, by: string) {
  const rules = book().getSheetByName(RULES)!;
  const keys = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
  for (const [key, category] of learned) {
    const i = keys.indexOf(key);
    if (i >= 0) rules.getRange(i + 2, 2, 1, 2).setValues([[category, by]]);
    else {
      rules.appendRow([key, category, by]);
      keys.push(key);
    }
  }
}

/** Fill in merchants where nothing better was known. */
function fillCategories(learned: Map<string, string>) {
  const sheet = book().getSheetByName(TX)!;
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const rows = sheet.getRange(2, 1, n, HEADERS.length).getValues();
  const cats = rows.map((r) => {
    const c = learned.get(String(r[C["Merchant key"]]));
    return [c && r[C.Category] === "Uncategorised" ? c : r[C.Category]];
  });
  sheet.getRange(2, C.Category + 1, n, 1).setValues(cats);
}

// ---- Gemini (optional) ----

/** Merchants per request. Later runs pick up the rest. */
const AI_BATCH = 150;
const HOUR = 3_600_000;

function setAiStatus(text: string) {
  book().getSheetByName(SETTINGS)!.getRange(3, 1, 1, 2).setValues([["Gemini categorising", text]]);
}

/**
 * Ask Gemini about merchants still Uncategorised, once each. Its answers are saved
 * to Rules (Set by: Gemini), so they're free afterwards and you can change them.
 */
function aiCategorise(): number {
  const key = PropertiesService.getUserProperties().getProperty("geminiKey");
  if (!key) return 0;
  const props = PropertiesService.getScriptProperties();
  if (Date.now() < Number(props.getProperty("aiRetryAt") ?? 0)) return 0;
  const tried = new Set<string>(JSON.parse(props.getProperty("aiTried") ?? "[]"));
  const { rows } = loadTransactions();
  const todo = new Map<string, Payee>();
  for (const r of rows) {
    const k = String(r[C["Merchant key"]]);
    if (todo.size >= AI_BATCH) break;
    if (r[C.Category] !== "Uncategorised" || r[C.Direction] !== "out" || !k || tried.has(k) || todo.has(k)) continue;
    todo.set(k, { id: todo.size, merchant: String(r[C.Merchant]), type: String(r[C.Type]), description: String(r[C.Description]) });
  }
  if (!todo.size) return 0;

  const payload = JSON.stringify(geminiRequest([...todo.values()]));
  let res!: GoogleAppsScript.URL_Fetch.HTTPResponse;
  for (const model of GEMINI_MODELS) {
    res = UrlFetchApp.fetch(geminiUrl(model), {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": key },
      payload,
      muteHttpExceptions: true,
    });
    // Busy or rate-limited: the next model may not be
    if (res.getResponseCode() !== 429 && res.getResponseCode() < 500) break;
  }
  const code = res.getResponseCode();
  if (code !== 200) {
    let why = res.getContentText().slice(0, 200);
    try {
      why = JSON.parse(res.getContentText()).error.message;
    } catch {}
    // Busy passes in minutes; a bad key won't fix itself
    const busy = code === 429 || code >= 500;
    props.setProperty("aiRetryAt", String(Date.now() + (busy ? 15 * 60_000 : HOUR)));
    setAiStatus(`Error ${code}: ${why} (tries again in ${busy ? "15 minutes" : "an hour"})`);
    return 0;
  }
  const answers = parseGeminiReply(res.getContentText());
  const learned = new Map<string, string>();
  for (const [k, p] of todo) {
    tried.add(k);
    const c = answers.get(p.id);
    if (c && c !== "Uncategorised") learned.set(k, c);
  }
  props.setProperty("aiTried", JSON.stringify([...tried].slice(-2000)));
  saveRules(learned, "Gemini");
  fillCategories(learned);
  setAiStatus(`On. ${Utilities.formatDate(new Date(), "Asia/Singapore", "yyyy-MM-dd HH:mm")}: categorised ${learned.size} of ${todo.size} merchants.`);
  return learned.size;
}

/** Menu: save a Gemini API key for this Google account, or remove it. */
export function setGeminiKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt(
    "Categorise with Gemini",
    "Paste a Gemini API key from https://aistudio.google.com/apikey\n\n" +
      "Names of uncategorised merchants (never amounts, dates or account numbers) are sent to Google's Gemini API. " +
      "On the free tier Google may use them to improve its products.\n\n" +
      "The key is kept in this script's private storage for your account, not in the sheet. Leave blank and press OK to turn this off.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const key = r.getResponseText().trim();
  ensureSheets();
  if (!key) {
    PropertiesService.getUserProperties().deleteProperty("geminiKey");
    setAiStatus("Off");
    ui.alert("Gemini categorising is off.");
    return;
  }
  PropertiesService.getUserProperties().setProperty("geminiKey", key);
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("aiRetryAt");
  // A new key is a fresh chance for merchants an earlier run couldn't place
  props.deleteProperty("aiTried");
  const lock = LockService.getScriptLock();
  lock.waitLock(30_000);
  try {
    const n = aiCategorise();
    const status = String(book().getSheetByName(SETTINGS)!.getRange(3, 2).getValue());
    ui.alert(status.startsWith("Error") ? status : `Done. Gemini categorised ${n} merchants. New ones are categorised as they arrive.`);
  } finally {
    lock.releaseLock();
  }
}

// ---- statements ----

export function showImport() {
  const html = HtmlService.createHtmlOutputFromFile("Import").setWidth(480).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, "Import statement");
}

/** Called from the import dialog with the text lines it read from a PDF in the browser. */
export function importStatement(fileName: string, lines: string[]) {
  const st = parseStatement(lines);
  if (!st) throw new Error(`${fileName}: not an OCBC or DBS/POSB statement I can read.`);
  const lock = LockService.getScriptLock();
  lock.waitLock(30_000);
  try {
    ensureSheets();
    const r = record(st.txns.map((t) => ({ txn: t, key: t.stmtKey, stmtKey: t.stmtKey })), "statement");
    const off = st.accounts.filter((a) => !a.balanced).map((a) => a.account);
    // A balance that doesn't add up is wrong somewhere; don't record it
    recordBalances(st.accounts.filter((a) => a.balanced));
    aiCategorise();
    buildRecurring();
    return (
      `${fileName}: ${st.txns.length} lines. ${r.added} added, ${r.matched} matched to email alerts, ${r.skipped} already imported. ` +
      (off.length ? `Warning: totals don't add up for ${off.join(", ")}, so some lines may be missing.` : "Totals check out.")
    );
  } finally {
    lock.releaseLock();
  }
}

const ymd = (d: unknown) => (d instanceof Date ? Utilities.formatDate(d, "Asia/Singapore", "yyyy-MM-dd") : String(d ?? ""));

const ACCOUNT_HEADERS = ["Account", "Balance", "As of", "Estimated now", "Last statement"] as const;
const PAYLAH_SETTING = "PayLah! payments come out of (an account from the Accounts tab; blank if your wallet holds its own money)";
const ACCOUNTS_NOTE =
  "Balance is exact as of its time: from a statement, or typed in with ugotmonee > Update balance. Estimated now adds the email alerts since then, so it misses money that moved without an alert (money coming into OCBC, NETS QR, card payments without card alerts).";

/**
 * Balance plus alerts timed after it. PayLah! alerts count against the account
 * named in Settings, since an empty wallet tops itself up from there.
 */
function balanceFormula(row: number) {
  const t = `'${TX}'`;
  const since = (dir: string, acct: string) => `SUMIFS(${t}!C:C,${t}!G:G,${acct},${t}!E:E,"${dir}",${t}!A:A,">"&C${row})`;
  const paylah = `IF('${SETTINGS}'!$B$4=A${row},${since("out", '"PayLah! Wallet"')},0)`;
  return `=B${row}+${since("in", `A${row}`)}-${since("out", `A${row}`)}-${paylah}`;
}

function formatAccounts(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  sheet.getRange("C2:C").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("E2:E").setNumberFormat("yyyy-mm-dd");
  sheet.getRange("G1").setValue(ACCOUNTS_NOTE);
}

/** Earlier layouts stored a statement's day at midnight and had no Last statement column. */
function upgradeAccounts() {
  const sheet = book().getSheetByName(ACCOUNTS)!;
  sheet.getRange(1, 1, 1, ACCOUNT_HEADERS.length).setValues([[...ACCOUNT_HEADERS]]).setFontWeight("bold");
  sheet.getRange("F1").setValue("");
  formatAccounts(sheet);
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  sheet.getRange(2, 1, n, 5).getValues().forEach((r, i) => {
    const row = i + 2;
    if (!(r[2] instanceof Date)) return;
    if (!r[4]) {
      // The old As of was a statement's last day: its balance holds until that day ends
      const end = new Date(`${ymd(r[2])}T23:59:59+08:00`);
      sheet.getRange(row, 3).setValue(end);
      sheet.getRange(row, 5).setValue(end);
    }
    sheet.getRange(row, 4).setFormula(balanceFormula(row));
  });
}

function accountNames(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  return sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
}

/** Keep each account's latest balance. An older statement doesn't overwrite a newer balance. */
function recordBalances(accounts: AccountCheck[]) {
  const sheet = book().getSheetByName(ACCOUNTS)!;
  formatAccounts(sheet);
  for (const a of accounts) {
    if (!a.asOf) continue;
    const i = accountNames(sheet).indexOf(a.account);
    const row = i >= 0 ? i + 2 : sheet.getLastRow() + 1;
    const end = new Date(`${a.asOf}T23:59:59+08:00`);
    const [, , asOf, , lastStatement] = i >= 0 ? sheet.getRange(row, 1, 1, 5).getValues()[0] : [];
    if (!(lastStatement instanceof Date) || lastStatement < end) sheet.getRange(row, 5).setValue(end);
    if (asOf instanceof Date && asOf > end) continue;
    sheet.getRange(row, 1, 1, 3).setValues([[a.account, a.closingCents / 100, end]]);
    sheet.getRange(row, 4).setFormula(balanceFormula(row));
    // PayLah! draws on a DBS/POSB account; assume the first one unless you've said otherwise
    const settings = book().getSheetByName(SETTINGS)!;
    if (a.account.startsWith("DBS/POSB") && !settings.getRange(4, 2).getValue()) settings.getRange(4, 2).setValue(a.account);
  }
}

/** Menu: type in what your banking app shows now. Alerts after this moment are added on top. */
export function updateBalances() {
  const ui = SpreadsheetApp.getUi();
  ensureSheets();
  const sheet = book().getSheetByName(ACCOUNTS)!;
  const names = accountNames(sheet);
  if (!names.length) {
    ui.alert("Import a statement first, so the sheet knows your accounts.");
    return;
  }
  formatAccounts(sheet);
  const done: string[] = [];
  for (const [i, name] of names.entries()) {
    const r = ui.prompt("Update balance", `${name}\n\nThe balance your banking app shows now. Leave blank to skip.`, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) break;
    const text = r.getResponseText().replace(/SGD|S?\$|,|\s/gi, "");
    if (!text) continue;
    const value = Number(text);
    if (!Number.isFinite(value)) {
      ui.alert(`"${r.getResponseText()}" isn't a number, so ${name} wasn't changed.`);
      continue;
    }
    const row = i + 2;
    sheet.getRange(row, 2, 1, 2).setValues([[value, new Date()]]);
    sheet.getRange(row, 4).setFormula(balanceFormula(row));
    done.push(name);
  }
  if (done.length) ui.alert(`Updated ${done.join(" and ")}. Alerts from now on are added on top, until a newer statement replaces it.`);
}

/** Monthly, on the 8th: email yourself if last month's statements haven't been imported. */
export function remindStatements() {
  ensureSheets();
  const sheet = book().getSheetByName(ACCOUNTS)!;
  const sgt = new Date(Date.now() + 8 * 3_600_000);
  // Last day of the previous month
  const due = new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues() : [];
  const last = (r: unknown[]) => ymd(r[4] || r[2]);
  const behind = rows.filter((r) => r[0] && last(r) < due).map((r) => `- ${r[0]}: latest statement imported ends ${last(r)}`);
  if (rows.length && !behind.length) return;

  const month = Utilities.formatDate(new Date(`${due}T00:00:00+08:00`), "Asia/Singapore", "MMMM yyyy");
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    `ugotmonee: import your ${month} statements`,
    [
      `Your bank statements for ${month} should be ready.`,
      "",
      ...(behind.length ? behind : ["- No statements imported yet."]),
      "",
      "1. Download the statement PDFs from OCBC and DBS/POSB internet banking.",
      `2. Open your sheet: ${book().getUrl()}`,
      "3. Click ugotmonee > Import statement (PDF) and pick the files.",
      "",
      "If the import says PERMISSION_DENIED, use a private window signed in to just this Google account.",
    ].join("\n"),
  );
}
