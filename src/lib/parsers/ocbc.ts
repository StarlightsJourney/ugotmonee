import type { ParseResult, RawEmail } from "./types";
import { expandYear, extractFields, monthIndex, parseAmount, parseTime, toSgtIso } from "./util";

function parseOcbcDate(dateRaw: string, timeRaw?: string): string | null {
  const d = dateRaw.match(/(\d{1,2})[\s-]([A-Za-z]{3,4})[\s-](\d{2,4})/);
  if (!d) return null;
  const mo = monthIndex(d[2]);
  if (!mo) return null;
  const t = timeRaw ? parseTime(timeRaw) : null;
  return toSgtIso(expandYear(d[3]), mo, parseInt(d[1], 10), t?.h ?? 0, t?.m ?? 0);
}

function parsePayNowOrTransfer(text: string): ParseResult | null {
  if (/following PayNow transfer could not be made/i.test(text)) return { status: "ignored", reason: "failed_transfer" };
  const header =
    text.match(/following PayNow transfer has been made to (.+?) using (?:their|his\/her) (Unique Entity Number|mobile(?: number)?|NRIC|VPA)/is) ??
    text.match(/following (.+?) has been sent via the OCBC app/i);
  if (!header) return null;

  const f = extractFields(text);
  const amount = f.amount && parseAmount(f.amount);
  const occurredAt = f.date && parseOcbcDate(f.date, f.time);
  if (!amount || !occurredAt) return { status: "unrecognised" };

  const isPayNow = /PayNow transfer/i.test(header[0]);
  let merchant: string;
  let payeeType: "business" | "person" | "unknown";
  if (isPayNow) {
    merchant = header[1].replace(/\s+/g, " ").trim();
    payeeType = /Entity/i.test(header[2]) ? "business" : "person";
  } else {
    merchant = (f.to ?? "").replace(/\s+using .*$/i, "").trim() || header[1].trim();
    payeeType = /mobile|NRIC/i.test(f.to ?? "") ? "person" : "unknown";
  }

  return {
    status: "parsed",
    txn: {
      source: "ocbc",
      kind: isPayNow ? "paynow" : "transfer",
      direction: "debit",
      ...amount,
      occurredAt,
      merchant,
      account: f["from your account"] ?? "OCBC",
      reference: f["reference number"] ?? null,
      description: isPayNow ? (f.description ?? null) : header[1].trim(),
      payeeType,
    },
  };
}

/** "We have received your request to make the following transfer", to another bank account. */
function parseFundsTransfer(text: string): ParseResult | null {
  if (!/request to make the following transfer/i.test(text)) return null;
  const f = extractFields(text);
  const amount = f.amount && parseAmount(f.amount);
  const occurredAt = f["date of transfer"] && parseOcbcDate(f["date of transfer"], f["time of transfer"]);
  const to = (f["to account"] ?? "").match(/^(.+?)\s*\((-?\w+)\)(?:\s+at\s+(.+))?$/);
  if (!amount || !occurredAt || !to) return { status: "unrecognised" };
  return {
    status: "parsed",
    txn: {
      source: "ocbc",
      kind: "transfer",
      direction: "debit",
      ...amount,
      occurredAt,
      merchant: to[1].trim(),
      account: f["from your account"] ?? "OCBC",
      reference: f["reference number"] ?? null,
      description: `Transfer to ${to[3]?.trim() ?? "account"} (${to[2]})`,
      payeeType: "person",
    },
  };
}

/** "The following NETS QR payment has been made:" Its account omits "OCBC"; add it so balances line up. */
function parseNetsQr(text: string): ParseResult | null {
  if (!/following NETS QR payment has been made/i.test(text)) return null;
  const f = extractFields(text);
  const amount = f.amount && parseAmount(f.amount);
  const occurredAt = f.date && parseOcbcDate(f.date, f.time);
  if (!amount || !occurredAt || !f.to) return { status: "unrecognised" };
  const account = f["from your account"] ?? "OCBC";
  return {
    status: "parsed",
    txn: {
      source: "ocbc",
      kind: "nets",
      direction: "debit",
      ...amount,
      occurredAt,
      merchant: f.to.replace(/\s+/g, " ").trim(),
      account: /^OCBC/i.test(account) ? account : `OCBC ${account}`,
      reference: f["reference number"] ?? null,
      description: "NETS QR",
      payeeType: "business",
    },
  };
}

function parseAtm(text: string): ParseResult | null {
  const m = text.match(
    /([A-Z]{3}\s*[\d,]+\.\d{2}) was withdrawn from your (.+?\(-?\d+\)) .*?at an? (.+?ATM)\. This was done at (\d{1,2}[:.]\d{2}(?:\s*[AP]M)?) on (\d{1,2} [A-Za-z]{3,4} \d{4})/is,
  );
  if (!m) return null;
  const amount = parseAmount(m[1]);
  const occurredAt = parseOcbcDate(m[5], m[4]);
  if (!amount || !occurredAt) return { status: "unrecognised" };
  return {
    status: "parsed",
    txn: {
      source: "ocbc",
      kind: "atm",
      direction: "debit",
      ...amount,
      occurredAt,
      merchant: m[3].trim(),
      account: m[2].trim(),
      reference: null,
      description: "ATM withdrawal",
      payeeType: "unknown",
    },
  };
}

function parseCard(text: string): ParseResult | null {
  const m = text.match(
    /([A-Z]{3}\s*[\d,]+(?:\.\d{1,2})?) was charged at (\d{1,2}:\d{2}(?:\s*[AP]M)?) on (\d{1,2}-[A-Za-z]{3}-\d{2,4}) to your card \((-?\d{4})\) at (.+?)\.\s*$/im,
  );
  if (!m) return null;
  const amount = parseAmount(m[1]);
  const occurredAt = parseOcbcDate(m[3], m[2]);
  if (!amount || !occurredAt) return { status: "unrecognised" };
  return {
    status: "parsed",
    txn: {
      source: "ocbc",
      kind: "card",
      direction: "debit",
      ...amount,
      occurredAt,
      merchant: m[5].trim(),
      account: `OCBC Card (${m[4]})`,
      reference: null,
      description: null,
      payeeType: "business",
    },
  };
}

export function parseOcbc(email: RawEmail, text: string): ParseResult | null {
  if (!/OCBC/i.test(text) && !/ocbc\.com/i.test(email.from ?? "")) return null;
  if (/monthly e-Statement/i.test(text)) return { status: "ignored", reason: "statement_notice" };
  return parsePayNowOrTransfer(text) ?? parseFundsTransfer(text) ?? parseNetsQr(text) ?? parseAtm(text) ?? parseCard(text);
}
