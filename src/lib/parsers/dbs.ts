import type { ParseResult, RawEmail } from "./types";
import { extractFields, inferYear, monthIndex, parseAmount, parseTime, toSgtIso } from "./util";

function parsePayLah(email: RawEmail, text: string): ParseResult | null {
  if (!/PayLah!/i.test(text)) return null;
  const f = extractFields(text);
  const dt = (f["date & time"] ?? "").match(/(\d{1,2})\s+([A-Za-z]{3,4})(?:\s+(\d{4}))?\s+(\d{1,2}:\d{2})/);
  const amount = f.amount && parseAmount(f.amount);
  if (!dt || !amount || !f.to) return { status: "unrecognised" };
  const mo = monthIndex(dt[2]);
  if (!mo) return { status: "unrecognised" };
  const d = parseInt(dt[1], 10);
  const y = dt[3] ? parseInt(dt[3], 10) : inferYear(mo, d, email.receivedAt);
  const t = parseTime(dt[4])!;
  const kindMatch = text.match(/your PayLah! (.+?) dated/i);
  // "BBT (Mobile ending 0000)" is a transfer to a person's phone number
  const toPhone = /\(Mobile ending \d+\)\s*$/i.test(f.to);

  return {
    status: "parsed",
    txn: {
      source: "dbs_paylah",
      kind: "ewallet",
      direction: "debit",
      ...amount,
      occurredAt: toSgtIso(y, mo, d, t.h, t.m),
      merchant: f.to.replace(/\s*\(Mobile ending \d+\)\s*$/i, "").trim(),
      account: "PayLah! Wallet",
      reference: f["transaction ref"] ?? null,
      description: kindMatch?.[1].trim() ?? null,
      payeeType: /Scan & Pay/i.test(kindMatch?.[1] ?? "") ? "business" : toPhone ? "person" : "unknown",
    },
  };
}

/** digibank "You have received SGD 300.00 via FAST transfer on 14 May 2026 11:14 SGT." */
function parseReceived(text: string): ParseResult | null {
  const m = text.match(/You have received ([A-Z]{3}\s*[\d,]+\.\d{2}) via (.+?) on (\d{1,2}) ([A-Za-z]{3,4}) (\d{4}) (\d{1,2}:\d{2})/i);
  if (!m) return null;
  const f = extractFields(text);
  const amount = parseAmount(m[1]);
  const mo = monthIndex(m[4]);
  const acct = (f.to ?? "").match(/ending (\d{4})/i);
  if (!amount || !mo || !acct) return { status: "unrecognised" };
  const t = parseTime(m[6])!;
  return {
    status: "parsed",
    txn: {
      source: "dbs",
      kind: /PayNow/i.test(m[2]) ? "paynow" : "transfer",
      direction: "credit",
      ...amount,
      occurredAt: toSgtIso(parseInt(m[5], 10), mo, parseInt(m[3], 10), t.h, t.m),
      merchant: (f.from ?? "Unknown sender").trim(),
      // Same label as the statement parser, so the balance estimate counts it
      account: `DBS/POSB (-${acct[1]})`,
      reference: f["transaction ref"] ?? null,
      description: `Received via ${m[2].trim()}`,
      payeeType: "unknown",
    },
  };
}

export function parseDbs(email: RawEmail, text: string): ParseResult | null {
  if (!/DBS|POSB/i.test(text) && !/dbs\.com/i.test(email.from ?? "")) return null;
  return parsePayLah(email, text) ?? parseReceived(text);
}
