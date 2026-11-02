import type { ParsedTxn } from "../parsers";
import { monthIndex, toSgtIso } from "../parsers/util";
import type { AccountCheck, Statement, StatementTxn } from "./types";
import { cents, check, direction, indentOf, informative, splitAmounts } from "./util";

interface Open {
  date: { d: number; m: number; y: number };
  type: string;
  indent: number;
  amount: number;
  balance: number | null;
  dir: ParsedTxn["direction"];
  lines: string[];
}

function describe(type: string, lines: string[]) {
  const all = `${type} ${lines.join(" ")}`;
  if (/TOP-?UP TO PAYLAH/i.test(all)) return { merchant: "PayLah! top-up", kind: "transfer" as const, payeeType: "unknown" as const };
  const after = lines.findIndex((l) => /PAYLAH! :$/i.test(l));
  const named = after >= 0 ? lines.slice(after + 1).find(informative) : lines.find(informative);
  return {
    merchant: named ?? type.replace(/^Advice\s+/i, ""),
    kind: /PayNow|FAST|Transfer/i.test(all) ? ("transfer" as const) : ("other" as const),
    payeeType: "unknown" as const,
  };
}

/** DBS/POSB consolidated statement: one or more deposit accounts, each with its own transaction table. */
export function parseDbsStatement(lines: string[]): Statement | null {
  if (!lines.some((l) => /DBS|POSB/.test(l)) || !lines.some((l) => /Transaction Details/i.test(l))) return null;

  // "Transaction Details as at 31 Jul 2026"
  const end = lines.map((l) => l.match(/as at (\d{1,2}) ([A-Za-z]{3}) (\d{4})/i)).find(Boolean);
  const endMonth = end && monthIndex(end[2]);
  const asOf = end && endMonth ? toSgtIso(+end[3], endMonth, +end[1]).slice(0, 10) : "";

  const header = lines.find((l) => /Withdrawal/.test(l) && /Deposit/.test(l));
  const cols = header ? { out: header.indexOf("Withdrawal"), in: header.indexOf("Deposit") } : null;

  const txns: StatementTxn[] = [];
  const accounts: AccountCheck[] = [];
  let account = "";
  let number = "";
  let opening: number | null = null;
  let balance: number | null = null;
  let open: Open | null = null;

  const close = () => {
    if (!open) return;
    const o = open;
    open = null;
    const d = describe(o.type, o.lines);
    const iso = toSgtIso(o.date.y, o.date.m, o.date.d);
    txns.push({
      source: "dbs",
      kind: d.kind,
      direction: o.dir,
      amountCents: o.amount,
      currency: "SGD",
      occurredAt: iso,
      merchant: d.merchant,
      account,
      reference: null,
      description: [o.type, ...o.lines].join(" / "),
      payeeType: d.payeeType,
      stmtKey: `dbs:stmt:${number}:${iso.slice(0, 10)}:${o.amount}:${o.balance ?? txns.length}`,
    });
  };
  const finish = () => {
    close();
    if (account && opening !== null) accounts.push(check(account, opening, balance ?? opening, asOf || txns[txns.length - 1]?.occurredAt.slice(0, 10) || "", txns));
    opening = null;
  };

  let inDetails = false;
  for (const line of lines) {
    if (/Transaction Details/i.test(line)) inDetails = true;
    if (!inDetails) continue;

    const acct = line.match(/Account No\.?\s*([\d-]{6,})/);
    if (acct) {
      if (acct[1] !== number) {
        finish();
        number = acct[1];
        account = `DBS/POSB (-${number.replace(/\D/g, "").slice(-4)})`;
      }
      continue;
    }
    const bf = line.match(/Balance Brought Forward\s+(?:SGD\s+)?([\d,]+\.\d{2})/i);
    if (bf) {
      close();
      balance = cents(bf[1]);
      opening ??= balance;
      continue;
    }
    if (/Balance Carried Forward/i.test(line)) {
      close();
      continue;
    }

    const t = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s+(.*)$/);
    const split = t && splitAmounts(t[4]);
    if (t && split) {
      close();
      // A date with only a balance closes the table
      if (!split.text) continue;
      const amount = split.amounts[0];
      const bal = split.amounts.length > 1 ? split.amounts[split.amounts.length - 1].cents : null;
      const at = line.length - t[4].length + amount.at;
      open = {
        date: { d: +t[1], m: +t[2], y: +t[3] },
        type: split.text,
        indent: line.length - t[4].length,
        amount: amount.cents,
        balance: bal,
        dir: direction(amount.cents, bal, balance, at, cols),
        lines: [],
      };
      balance = bal ?? (balance === null ? null : open.dir === "debit" ? balance - amount.cents : balance + amount.cents);
      continue;
    }

    const text = line.trim();
    if (open && text && Math.abs(indentOf(line) - open.indent) <= 3 && !/^\d{1,4}$/.test(text)) open.lines.push(text);
  }
  finish();

  if (!accounts.length) return null;
  return { bank: "DBS", txns, accounts };
}
