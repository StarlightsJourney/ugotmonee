// Runs the Apps Script code against an in-memory stand-in for Sheets and Gmail.
// Covers the glue: sync, dedup, statement merge, learning a category.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importStatement, onEdit, remindStatements, setGeminiKey, setup, sync, updateBalances } from "./main";

class FakeRange {
  constructor(private sheet: FakeSheet, private r: number, private c: number, private nr: number, private nc: number) {}
  getValues() {
    return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.sheet.cells[this.r - 1 + i]?.[this.c - 1 + j] ?? ""));
  }
  getValue() {
    return this.getValues()[0][0];
  }
  setValues(v: unknown[][]) {
    v.forEach((row, i) => row.forEach((x, j) => ((this.sheet.cells[this.r - 1 + i] ??= [])[this.c - 1 + j] = x)));
    return this;
  }
  setValue(x: unknown) {
    return this.setValues([[x]]);
  }
  sort({ column, ascending }: { column: number; ascending: boolean }) {
    const rows = this.getValues().sort((a, b) => {
      const d = +(a[column - this.c] as Date) - +(b[column - this.c] as Date);
      return ascending ? d : -d;
    });
    return this.setValues(rows);
  }
  getSheet() {
    return this.sheet;
  }
  getRow() {
    return this.r;
  }
  getColumn() {
    return this.c;
  }
  getNumRows() {
    return this.nr;
  }
  setFontWeight() {
    return this;
  }
  setNumberFormat() {
    return this;
  }
  setDataValidation() {
    return this;
  }
  setFormula(f: string) {
    return this.setValues([[f]]);
  }
}

class FakeSheet {
  cells: unknown[][] = [];
  constructor(private name: string) {}
  getName() {
    return this.name;
  }
  getLastRow() {
    return this.cells.length;
  }
  getRange(a: number | string, c = 1, nr = 1, nc = 1) {
    if (typeof a === "number") return new FakeRange(this, a, c, nr, nc);
    // "B4" or "A4:C12"; open-ended ranges like "C2:C" are only formatted, so one cell will do
    const cell = (x: string) => {
      const m = x.match(/^([A-Z]+)(\d*)$/)!;
      return { col: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0), row: Number(m[2]) || 1 };
    };
    const [p, q = p] = a.split(":").map(cell);
    return new FakeRange(this, p.row, p.col, Math.max(1, q.row - p.row + 1), q.col - p.col + 1);
  }
  clearContents() {
    this.cells = [];
  }
  deleteRows(from: number, n: number) {
    this.cells.splice(from - 1, n);
  }
  appendRow(row: unknown[]) {
    this.cells.push(row);
  }
  rules: unknown[] = [];
  getConditionalFormatRules() {
    return this.rules;
  }
  setConditionalFormatRules(r: unknown[]) {
    this.rules = r;
  }
  setFrozenRows() {}
  hideColumns() {}
  setColumnWidth() {}
  insertChart() {}
  newChart() {
    const b = { setChartType: () => b, setNumHeaders: () => b, addRange: () => b, setPosition: () => b, setOption: () => b, build: () => ({}) };
    return b;
  }
}

let sheets: Map<string, FakeSheet>;
let inbox: { id: string; at: string; from: string; text: string; asBytes?: boolean }[];
const props = new Map<string, string>();
const userProps = new Map<string, string>();
let fetched: { url: string; key: string; body: string }[];
let geminiReply: (body: string) => { code: number; text: string };
let promptAnswer: string;
let promptQueue: string[];
let quotaAfter: number | null;
let mail: { to: string; subject: string; body: string }[];

const b64 = (s: string) => Buffer.from(s).toString("base64url");

beforeEach(() => {
  sheets = new Map();
  inbox = [];
  mail = [];
  fetched = [];
  promptAnswer = "";
  promptQueue = [];
  quotaAfter = null;
  props.clear();
  userProps.clear();
  const book = {
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => {
      const s = new FakeSheet(n);
      sheets.set(n, s);
      return s;
    },
    deleteSheet: (s: FakeSheet) => sheets.delete(s.getName()),
    setSpreadsheetTimeZone: () => {},
    toast: () => {},
    getUrl: () => "https://docs.google.com/spreadsheets/d/test",
  };
  vi.stubGlobal("SpreadsheetApp", {
    getActiveSpreadsheet: () => book,
    getUi: () => ({
      alert: () => {},
      prompt: () => {
        const answer = promptQueue.length ? promptQueue.shift()! : promptAnswer;
        return { getSelectedButton: () => "OK", getResponseText: () => answer };
      },
      ButtonSet: { OK_CANCEL: "OK_CANCEL" },
      Button: { OK: "OK" },
    }),
    newDataValidation: () => {
      const b = { requireValueInList: () => b, requireValueInRange: () => b, setAllowInvalid: () => b, build: () => ({}) };
      return b;
    },
    newConditionalFormatRule: () => {
      const b = { whenFormulaSatisfied: () => b, setFontColor: () => b, setBackground: () => b, setRanges: () => b, build: () => ({ rule: true }) };
      return b;
    },
  });
  vi.stubGlobal("Charts", { ChartType: { PIE: "PIE", COLUMN: "COLUMN", BAR: "BAR" } });
  vi.stubGlobal("UrlFetchApp", {
    fetch: (url: string, o: { headers: Record<string, string>; payload: string }) => {
      fetched.push({ url, key: o.headers["x-goog-api-key"], body: o.payload });
      const r = geminiReply(o.payload);
      return { getResponseCode: () => r.code, getContentText: () => r.text };
    },
  });
  vi.stubGlobal("Session", { getEffectiveUser: () => ({ getEmail: () => "me@example.com" }) });
  vi.stubGlobal("MailApp", { sendEmail: (to: string, subject: string, body: string) => mail.push({ to, subject, body }) });
  vi.stubGlobal("ScriptApp", {
    getProjectTriggers: () => [],
    newTrigger: () => {
      const b = { timeBased: () => b, everyMinutes: () => b, onMonthDay: () => b, atHour: () => b, create: () => ({}) };
      return b;
    },
  });
  vi.stubGlobal("LockService", { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({
      getProperty: (k: string) => props.get(k) ?? null,
      setProperty: (k: string, v: string) => props.set(k, v),
      deleteProperty: (k: string) => props.delete(k),
    }),
    getUserProperties: () => ({
      getProperty: (k: string) => userProps.get(k) ?? null,
      setProperty: (k: string, v: string) => userProps.set(k, v),
      deleteProperty: (k: string) => userProps.delete(k),
    }),
  });
  vi.stubGlobal("Utilities", {
    base64DecodeWebSafe: (s: string) => {
      if (typeof s !== "string" || !/^[A-Za-z0-9_-]*=*$/.test(s)) throw new Error("Could not decode string.");
      return Buffer.from(s, "base64url");
    },
    newBlob: (bytes: Buffer | number[]) => ({ getDataAsString: () => Buffer.from(bytes).toString("utf8") }),
    formatDate: (d: Date, _tz: string, fmt: string) => {
      const sgt = new Date(d.getTime() + 8 * 3_600_000).toISOString();
      if (fmt === "yyyy-MM-dd") return sgt.slice(0, 10);
      if (fmt === "yyyy-MM-dd HH:mm") return sgt.slice(0, 16).replace("T", " ");
      return new Date(sgt.slice(0, 10)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    },
  });
  vi.stubGlobal("Gmail", {
    Users: {
      Messages: {
        // Newest first, like Gmail
        list: () => ({ messages: [...inbox].reverse().map((m) => ({ id: m.id })) }),
        get: (_: string, id: string) => {
          if (quotaAfter !== null && quotaAfter-- <= 0) throw new Error("Quota exceeded for quota metric 'Total Query Cost'");
          const m = inbox.find((x) => x.id === id)!;
          return {
            internalDate: String(Date.parse(m.at)),
            payload: {
              mimeType: "multipart/alternative",
              headers: [{ name: "From", value: m.from }],
              // The real advanced service returns bytes; the docs say base64url. Cover both.
              parts: [{ mimeType: "text/plain", body: { data: m.asBytes ? [...Buffer.from(m.text)] : b64(m.text) } }],
            },
          };
        },
      },
    },
  });
});

const paynow = (merchant: string, amount: string, ref: string) => `The following PayNow transfer has been made to ${merchant} using their Unique Entity Number (UEN) 00000000X.

Date\t: 19 Sep 2026
Time\t: 14:46 PM SGT
Amount\t: SGD ${amount}
From your account\t: OCBC FRANK Account (-000001)
Reference number\t: ${ref}
OCBC`;

const tx = () => sheets.get("Transactions")!.cells.slice(1);

const ocbcSep = (end = "30 SEP 2026", closing = "94.40") => `
          OCBC FRANK ACCOUNT                         STATEMENT OF ACCOUNT    1 SEP 2026 TO ${end}
          Account No. 000000000001
          Date             Date             Description          Withdrawal       Deposit        Balance
                                            BALANCE B/F                                          100.00
          19 SEP           19 SEP           FAST PAYMENT              4.50                        95.50
                                            via PayNow-UEN
                                            to AB FOOD CENTRE P
          20 SEP           20 SEP           NETS QR                   1.10                        ${closing}
                                            NETS QR PURCHASE
                                            DRINK STALL
                                            BALANCE C/F                                           ${closing}`.split("\n");

describe("Apps Script", () => {
  it("syncs alerts once, however often it runs", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1") });
    inbox.push({ id: "b", at: "2026-09-19T07:00:00Z", from: "Notifications@ocbc.com", text: "OCBC: your SGD 9.99 thing we don't parse" });
    setup();
    sync();
    expect(tx()).toHaveLength(1);
    expect(tx()[0].slice(1, 6)).toEqual(["AB FOOD CENTRE PTE LTD", 4.5, "SGD", "out", "Food & Drinks"]);
    expect(sheets.get("Unrecognised")!.cells).toHaveLength(2);
  });

  it("reads email bodies that come back as bytes", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1"), asBytes: true });
    setup();
    expect(tx()).toHaveLength(1);
  });

  it("re-reads Unrecognised emails once the parsers change, and keeps the ones still unknown", () => {
    setup();
    const u = sheets.get("Unrecognised")!;
    u.cells.push([new Date(), "Notifications@ocbc.com", "", "old", "SGD 1.00 old"], [new Date(), "x", "", "junk", "SGD 9.99"]);
    inbox.push({ id: "old", at: "2026-05-14T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1") });
    inbox.push({ id: "junk", at: "2026-05-14T07:00:00Z", from: "Notifications@ocbc.com", text: "OCBC: your SGD 9.99 thing we don't parse" });
    // Gmail's search is past these by now
    const list = (globalThis as unknown as { Gmail: { Users: { Messages: { list: unknown } } } }).Gmail.Users.Messages;
    list.list = () => ({ messages: [] });
    props.delete("parsers");
    sync();
    expect(tx().map((r) => r[1])).toEqual(["AB FOOD CENTRE PTE LTD"]);
    expect(u.cells.slice(1).map((r) => r[3])).toEqual(["junk"]);
    sync();
    expect(u.cells.slice(1).map((r) => r[3])).toEqual(["junk"]);
  });

  it("marks earlier transfers to yourself once your name is in Settings", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1") });
    inbox.push({ id: "b", at: "2026-09-19T07:46:00Z", from: "Notifications@ocbc.com", text: paynow("JANE TAN", "300.00", "2").replace("their Unique Entity Number (UEN) 00000000X", "their mobile number") });
    setup();
    expect(tx().map((r) => r[5])).toEqual(["Food & Drinks", "Transfers"]);
    const settings = sheets.get("Settings")!;
    settings.getRange(2, 2).setValue("TAN AH KOW, JANE TAN");
    onEdit({ range: settings.getRange(2, 2), value: "TAN AH KOW, JANE TAN" } as never);
    expect(tx().map((r) => r[5])).toEqual(["Food & Drinks", "Own transfers"]);
  });

  it("stops at Gmail's rate limit and picks up from there next run", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1") });
    inbox.push({ id: "b", at: "2026-09-20T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("KOUFU PTE LTD", "3.00", "2") });
    quotaAfter = 1;
    setup();
    expect(tx()).toHaveLength(1);
    expect(sheets.get("Unrecognised")!.cells).toHaveLength(1);
    quotaAfter = null;
    sync();
    expect(tx().map((r) => r[1]).sort()).toEqual(["AB FOOD CENTRE PTE LTD", "KOUFU PTE LTD"]);
  });

  it("merges a statement line into its email alert, and re-importing adds nothing", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("AB FOOD CENTRE PTE LTD", "4.50", "1") });
    setup();
    const lines = ocbcSep();
    expect(importStatement("sep.pdf", lines)).toMatch(/2 lines\. 1 added, 1 matched .* Totals check out/);
    expect(importStatement("sep.pdf", lines)).toMatch(/0 added, 0 matched to email alerts, 2 already imported/);
    expect(tx().map((r) => [r[1], r[9]])).toEqual([
      ["DRINK STALL", "statement"],
      ["AB FOOD CENTRE PTE LTD", "both"],
    ]);
  });

  it("adds in/out colours once and rebuilds an old Summary and Trends on the next sync", () => {
    setup();
    sync();
    expect(sheets.get("Transactions")!.rules).toHaveLength(2);
    expect(sheets.get("Trends")!.cells[3][0]).toBe("Spent this month");
    props.delete("layout");
    const before = [sheets.get("Summary"), sheets.get("Trends")];
    sync();
    expect(sheets.get("Summary")).not.toBe(before[0]);
    expect(sheets.get("Trends")).not.toBe(before[1]);
    expect(sheets.get("Transactions")!.rules).toHaveLength(4);
    sync();
    expect(sheets.get("Transactions")!.rules).toHaveLength(4);
  });

  it("learns a category from an edit and fills in the same merchant", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "4.50", "1") });
    inbox.push({ id: "b", at: "2026-09-19T07:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "3.00", "2") });
    setup();
    expect(tx().map((r) => r[5])).toEqual(["Uncategorised", "Uncategorised"]);
    const sheet = sheets.get("Transactions")!;
    sheet.getRange(2, 6).setValue("Shopping");
    onEdit({ range: sheet.getRange(2, 6), value: "Shopping" } as never);
    expect(tx().map((r) => r[5])).toEqual(["Shopping", "Shopping"]);
    expect(sheets.get("Rules")!.cells[1]).toEqual(["ACME TRADING", "Shopping", "you"]);

    inbox.push({ id: "c", at: "2026-09-20T07:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "1.00", "3") });
    sync();
    expect(tx()[0][5]).toBe("Shopping");
  });
});

describe("balances and reminders", () => {
  const accounts = () => sheets.get("Accounts")!.cells.slice(1);

  it("records the statement balance and won't let an older statement overwrite it", () => {
    setup();
    expect(importStatement("sep.pdf", ocbcSep())).toMatch(/Totals check out/);
    expect(accounts()[0].slice(0, 2)).toEqual(["OCBC FRANK Account (-000001)", 94.4]);
    // The balance holds until the end of the statement's last day
    expect((accounts()[0][2] as Date).toISOString()).toBe("2026-09-30T15:59:59.000Z");

    // An earlier statement for the same account: its balance is older, so it's ignored
    importStatement("aug.pdf", ocbcSep("30 AUG 2026"));
    expect(accounts()).toHaveLength(1);
    expect((accounts()[0][2] as Date).toISOString()).toBe("2026-09-30T15:59:59.000Z");
  });

  it("takes a balance typed in now, and a later statement for an earlier month doesn't replace it", () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T04:00:00Z"), toFake: ["Date"] });
    setup();
    importStatement("sep.pdf", ocbcSep());
    promptQueue = ["SGD 3,473.15"];
    updateBalances();
    expect(accounts()[0][1]).toBe(3473.15);
    expect((accounts()[0][2] as Date).toISOString()).toBe("2026-11-03T04:00:00.000Z");
    expect(accounts()[0][3]).toMatch(/^=B2\+SUMIFS\(.*">"&C2\)/);

    importStatement("oct.pdf", ocbcSep("31 OCT 2026"));
    expect(accounts()[0][1]).toBe(3473.15);
    expect((accounts()[0][4] as Date).toISOString()).toBe("2026-10-31T15:59:59.000Z");
    vi.useRealTimers();
  });

  it("emails a reminder when last month's statement is missing, and stays quiet once it's in", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T01:00:00Z"), toFake: ["Date"] });
    setup();
    remindStatements();
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: "me@example.com", subject: "ugotmonee: import your September 2026 statements" });
    expect(mail[0].body).toMatch(/No statements imported yet[\s\S]*docs\.google\.com/);

    importStatement("sep.pdf", ocbcSep());
    remindStatements();
    expect(mail).toHaveLength(1);

    // A balance typed in today isn't a statement: October is still missing
    promptQueue = ["100"];
    vi.setSystemTime(new Date("2026-11-03T01:00:00Z"));
    updateBalances();

    vi.setSystemTime(new Date("2026-11-08T01:00:00Z"));
    remindStatements();
    expect(mail[1].subject).toBe("ugotmonee: import your October 2026 statements");
    expect(mail[1].body).toMatch(/OCBC FRANK Account \(-000001\): latest statement imported ends 2026-09-30/);
    vi.useRealTimers();
  });
});

describe("Gemini categorising", () => {
  const reply = (answers: { id: number; category: string }[]) => ({
    code: 200,
    text: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answers) }] } }] }),
  });

  it("does nothing without a key", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "4.50", "1") });
    setup();
    expect(fetched).toHaveLength(0);
  });

  it("sends only merchant names, saves answers as rules, and asks about each merchant once", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "4.50", "1") });
    inbox.push({ id: "b", at: "2026-09-19T07:46:00Z", from: "Notifications@ocbc.com", text: paynow("ZORBLAX HOLDINGS", "3.00", "2") });
    setup();
    geminiReply = (body) => {
      const lines = JSON.parse(body).contents[0].parts[0].text as string;
      const id = (name: string) => JSON.parse(lines.split("\n").find((l) => l.includes(name))!).id;
      return reply([
        { id: id("ACME"), category: "Shopping" },
        { id: id("ZORBLAX"), category: "Uncategorised" },
      ]);
    };
    promptAnswer = "test-key";
    setGeminiKey();

    expect(fetched).toHaveLength(1);
    expect(fetched[0].key).toBe("test-key");
    expect(fetched[0].body).not.toMatch(/4\.5|3\.00|000001|2026/);
    expect(tx().map((r) => [r[1], r[5]])).toEqual([
      ["ACME TRADING", "Shopping"],
      ["ZORBLAX HOLDINGS", "Uncategorised"],
    ]);
    expect(sheets.get("Rules")!.cells[1]).toEqual(["ACME TRADING", "Shopping", "Gemini"]);
    expect(sheets.get("Settings")!.cells[2][1]).toMatch(/^On\. .*categorised 1 of 2 merchants/);
    expect(JSON.stringify(userProps.get("geminiKey"))).not.toMatch(/Settings/);

    sync();
    expect(fetched).toHaveLength(1);
  });

  it("backs off for an hour after an error and shows why", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "4.50", "1") });
    setup();
    geminiReply = () => ({ code: 400, text: JSON.stringify({ error: { message: "API key not valid." } }) });
    promptAnswer = "bad-key";
    setGeminiKey();
    expect(sheets.get("Settings")!.cells[2][1]).toBe("Error 400: API key not valid. (tries again in an hour)");
    sync();
    expect(fetched).toHaveLength(1);
  });

  it("falls back to the lighter model when Gemini is busy, and retries in 15 minutes if both are", () => {
    inbox.push({ id: "a", at: "2026-09-19T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ACME TRADING", "4.50", "1") });
    setup();
    const busy = { code: 503, text: JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }) };
    geminiReply = () => (fetched.length === 1 ? busy : reply([{ id: 0, category: "Shopping" }]));
    promptAnswer = "test-key";
    setGeminiKey();
    expect(fetched.map((f) => f.url.match(/models\/([^:]+)/)![1])).toEqual(["gemini-flash-latest", "gemini-flash-lite-latest"]);
    expect(tx()[0][5]).toBe("Shopping");

    inbox.push({ id: "b", at: "2026-09-20T06:46:00Z", from: "Notifications@ocbc.com", text: paynow("ZORBLAX HOLDINGS", "3.00", "2") });
    geminiReply = () => busy;
    sync();
    expect(fetched).toHaveLength(4);
    expect(sheets.get("Settings")!.cells[2][1]).toMatch(/^Error 503: .* \(tries again in 15 minutes\)$/);
    sync();
    expect(fetched).toHaveLength(4);
  });

  it("turns off with a blank key", () => {
    userProps.set("geminiKey", "k");
    setup();
    promptAnswer = "";
    setGeminiKey();
    expect(userProps.has("geminiKey")).toBe(false);
    expect(sheets.get("Settings")!.cells[2][1]).toBe("Off");
  });
});

describe("recurring payments and generic statement lines", () => {
  it("lists a monthly charge, flags one that stopped, and moves subscriptions to their own category", () => {
    setup();
    const tx = sheets.get("Transactions")!;
    const row = (date: string, merchant: string, amount: number, category: string) => {
      const r: unknown[] = [];
      r[0] = new Date(`${date}T00:00:00+08:00`);
      r[1] = merchant;
      r[2] = amount;
      r[4] = "out";
      r[5] = category;
      r[6] = "OCBC FRANK Account (-000001)";
      r[8] = "";
      r[9] = "statement";
      r[11] = merchant;
      return r;
    };
    vi.useFakeTimers({ now: new Date("2026-11-03T04:00:00Z"), toFake: ["Date"] });
    for (const m of ["06", "07", "08", "09"]) tx.cells.push(row(`2026-${m}-10`, "PHONE PLAN CO", 10.1, "Bills & Utilities"));
    tx.cells.push(row("2026-09-06", "ANTHROPIC* CLAUDE", 30, "Entertainment"));
    tx.cells.push(row("2026-10-30", "SOMEWHERE", 1, "Food & Drinks"));
    // Gemini guessed Entertainment earlier; that guess should move too
    sheets.get("Rules")!.cells.push(["ANTHROPIC CLAUDE", "Entertainment", "Gemini"]);
    props.delete("layout");
    sync();

    expect(tx.cells.find((r) => r[1] === "ANTHROPIC* CLAUDE")![5]).toBe("Subscriptions");
    const rec = sheets.get("Recurring")!.cells.slice(1).filter((r) => r[0]);
    const phone = rec.find((r) => r[0] === "PHONE PLAN CO")!;
    expect(phone.slice(1, 6)).toEqual(["Subscription", "Bills & Utilities", 10.1, "month", 4]);
    expect(phone[9]).toMatch(/^Not in your statements since 2026-09-10/);
    expect(rec.find((r) => r[0] === "ANTHROPIC* CLAUDE")!.slice(1, 5)).toEqual(["Subscription", "Subscriptions", 30, "seen once"]);
    expect(sheets.get("Rules")!.cells.find((r) => r[0] === "ANTHROPIC CLAUDE")![1]).toBe("Subscriptions");
    vi.useRealTimers();
  });

  it("merges DBS's 'FAST Payment / Receipt' line with the alert that names the sender", () => {
    inbox.push({
      id: "a",
      at: "2026-05-14T03:15:00Z",
      from: "ibanking.alert@dbs.com",
      text: "DBS\nYou have received SGD 300.00 via FAST transfer on 14 May 2026 11:14 SGT.\nFrom: JANE TAN\nTo: Your DBS/ POSB account ending 0002",
    });
    setup();
    sheets.get("Settings")!.getRange(2, 2).setValue("JANE TAN");
    const tx = sheets.get("Transactions")!;
    // Pretend the statement line came first, then re-read the alert
    tx.cells.splice(1);
    const r: unknown[] = [];
    r[0] = new Date("2026-05-14T00:00:00+08:00");
    r[1] = "FAST Payment / Receipt";
    r[2] = 300;
    r[4] = "in";
    r[5] = "Income";
    r[6] = "DBS/POSB (-0002)";
    r[9] = "statement";
    r[11] = "FAST PAYMENT RECEIPT";
    r[13] = "dbs:stmt:1";
    tx.cells.push(r);
    props.delete("cursor");
    sync();
    expect(tx.cells.slice(1).map((x) => [x[1], x[5], x[9]])).toEqual([["JANE TAN", "Own transfers", "both"]]);
  });
});
