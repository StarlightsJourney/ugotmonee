import type { TxnDirection } from "../parsers";
import type { AccountCheck, StatementTxn } from "./types";

export const AMOUNT = /[\d,]+\.\d{2}/g;

export function cents(raw: string): number {
  return Math.round(parseFloat(raw.replace(/,/g, "")) * 100);
}

export const indentOf = (line: string) => line.length - line.trimStart().length;

/** Split "FAST PAYMENT      4.00      3,856.29" into the text and the trailing amounts. */
export function splitAmounts(rest: string): { text: string; amounts: { cents: number; at: number }[] } | null {
  const m = rest.match(/^(.*?)((?:\s+[\d,]+\.\d{2})+)\s*$/);
  if (!m) return null;
  const amounts: { cents: number; at: number }[] = [];
  const base = m[1].length;
  for (const a of m[2].matchAll(AMOUNT)) amounts.push({ cents: cents(a[0]), at: base + a.index! });
  return { text: m[1].trim(), amounts };
}

/**
 * Work out whether a line took money out or put it in. The running balance
 * says for certain; without one, fall back to which header column the
 * amount sits under.
 */
export function direction(
  amount: number,
  balance: number | null,
  prev: number | null,
  at: number,
  cols: { out: number; in: number } | null,
): TxnDirection {
  if (balance !== null && prev !== null) {
    if (prev - amount === balance) return "debit";
    if (prev + amount === balance) return "credit";
  }
  if (cols) return Math.abs(at - cols.out) <= Math.abs(at - cols.in) ? "debit" : "credit";
  return "debit";
}

/** Lines that carry a merchant or payee, not codes, dates or boilerplate. */
export function informative(line: string): boolean {
  return /[A-Za-z]{2,}/.test(line) && !/^(OTHR|OTHER|via |NETS QR PURCHASE|\d{2}\/\d{2}\/\d{2,4}$)/i.test(line) && !/^[A-Z0-9-]*\d{6,}[A-Z0-9-]*$/.test(line);
}

export function check(account: string, opening: number, closing: number, asOf: string, txns: StatementTxn[]): AccountCheck {
  let debitCents = 0;
  let creditCents = 0;
  for (const t of txns) {
    if (t.account !== account) continue;
    if (t.direction === "debit") debitCents += t.amountCents;
    else creditCents += t.amountCents;
  }
  return { account, openingCents: opening, closingCents: closing, asOf, debitCents, creditCents, balanced: opening - debitCents + creditCents === closing };
}
