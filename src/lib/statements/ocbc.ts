import type { ParsedTxn } from "../parsers";
import { monthIndex, toSgtIso } from "../parsers/util";
import type { Statement, StatementTxn } from "./types";
import { cents, check, direction, indentOf, informative, splitAmounts } from "./util";

interface Open {
  day: number;
  mon: number;
  type: string;
  indent: number;
  amount: number;
  balance: number | null;
  dir: ParsedTxn["direction"];
  lines: string[];
}

/** Turn a statement line's type and description lines into merchant, kind and payee. */
function describe(type: string, lines: string[]) {
  const card = lines.map((l) => l.match(/^xx-(\d{4})\s+(.+)$/)).find(Boolean);
  const bought = lines.map((l) => l.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)).find(Boolean);
  const to = lines.map((l) => l.match(/^(?:to|from)\s+(.+)$/i)).find(Boolean);
  const all = lines.join(" ");

  if (card)
    return {
      merchant: card[2].trim(),
      kind: "card" as const,
      payeeType: "business" as const,
      card: card[1],
      bought: bought ? { d: +bought[1], m: +bought[2], y: 2000 + +bought[3] } : null,
    };
  if (/NETS QR/i.test(type))
    return { merchant: lines.filter(informative).pop() ?? type, kind: "nets" as const, payeeType: "business" as const };
  if (to)
    return {
      merchant: to[1].trim(),
      kind: /PayNow/i.test(all) ? ("paynow" as const) : ("transfer" as const),
      payeeType: /PayNow-UEN/i.test(all) ? ("business" as const) : /PayNow-(Mobile|NRIC)/i.test(all) ? ("person" as const) : ("unknown" as const),
    };
  const named = /FEE|CHARGE|REBATE/i.test(type) ? undefined : lines.find(informative);
  return { merchant: named ?? type, kind: "other" as const, payeeType: "unknown" as const };
}

/**
 * Statement lines carry no year. A month up to the period's end is the end's year, except
 * December on a January statement. The month right after the end is a credit posted on the 1st
 * (interest on 01 AUG for a July statement): still the same year, or the next one after December.
 */
export function lineYear(mon: number, endMonth: number, endYear: number) {
  if (endMonth === 12 && mon === 1) return endYear + 1;
  if (endMonth === 1 && mon === 12) return endYear - 1;
  return mon > endMonth + 1 ? endYear - 1 : endYear;
}

export function parseOcbcStatement(lines: string[]): Statement | null {
  if (!lines.some((l) => /STATEMENT OF ACCOUNT/i.test(l)) || !lines.some((l) => /OCBC/.test(l))) return null;

  const period = lines.map((l) => l.match(/(\d{1,2}) ([A-Z]{3}) (\d{4}) TO (\d{1,2}) ([A-Z]{3}) (\d{4})/)).find(Boolean);
  if (!period) return null;
  const endMonth = monthIndex(period[5])!;
  const endYear = +period[6];
  const name = lines.map((l) => l.trim().match(/^(OCBC [A-Z0-9 ]*?ACCOUNT)\b/)).find(Boolean)?.[1] ?? "OCBC ACCOUNT";
  const number = lines.map((l) => l.match(/Account No\.?\s*(\d{6,})/)).find(Boolean)?.[1] ?? "";
  // Same label the email alerts use: "OCBC FRANK Account (-000001)"
  const account = `${name.replace(/ACCOUNT$/, "Account")} (-${number.slice(-6)})`;

  const header = lines.find((l) => /Withdrawal/.test(l) && /Deposit/.test(l));
  const cols = header ? { out: header.indexOf("Withdrawal"), in: header.indexOf("Deposit") } : null;

  const txns: StatementTxn[] = [];
  let opening: number | null = null;
  let balance: number | null = null;
  let open: Open | null = null;

  const close = () => {
    if (!open) return;
    const o = open;
    open = null;
    const d = describe(o.type, o.lines);
    const year = lineYear(o.mon, endMonth, endYear);
    const when = "bought" in d && d.bought ? d.bought : { d: o.day, m: o.mon, y: year };
    const posted = toSgtIso(year, o.mon, o.day).slice(0, 10);
    txns.push({
      source: "ocbc",
      kind: d.kind,
      direction: o.dir,
      amountCents: o.amount,
      currency: "SGD",
      occurredAt: toSgtIso(when.y, when.m, when.d),
      merchant: d.merchant,
      account,
      reference: null,
      description: [o.type, ...o.lines].join(" / "),
      payeeType: d.payeeType,
      stmtKey: `ocbc:stmt:${number}:${posted}:${o.amount}:${o.balance ?? txns.length}`,
    });
  };

  for (const line of lines) {
    const bf = line.match(/BALANCE B\/F\s+([\d,]+\.\d{2})/);
    if (bf) {
      close();
      balance = cents(bf[1]);
      opening ??= balance;
      continue;
    }
    if (/BALANCE C\/F/.test(line)) {
      close();
      continue;
    }

    const t = line.match(/^\s*(\d{2}) ([A-Z]{3})\s+\d{2} [A-Z]{3}\s+(.*)$/);
    const mon = t && monthIndex(t[2]);
    const split = t && splitAmounts(t[3]);
    if (t && mon && split && split.amounts.length) {
      close();
      const amount = split.amounts[0];
      const bal = split.amounts.length > 1 ? split.amounts[split.amounts.length - 1].cents : null;
      const at = line.length - t[3].length + amount.at;
      open = {
        day: +t[1],
        mon,
        type: split.text,
        indent: line.length - t[3].length,
        amount: amount.cents,
        balance: bal,
        dir: direction(amount.cents, bal, balance, at, cols),
        lines: [],
      };
      balance = bal ?? (balance === null ? null : open.dir === "debit" ? balance - amount.cents : balance + amount.cents);
      continue;
    }

    // Description lines sit under the type; page footers and codes don't.
    const text = line.trim();
    if (open && text && Math.abs(indentOf(line) - open.indent) <= 3 && !/^\d{1,4}$/.test(text)) open.lines.push(text);
  }
  close();

  if (opening === null) return null;
  const asOf = toSgtIso(endYear, endMonth, +period[4]).slice(0, 10);
  return { bank: "OCBC", txns, accounts: [check(account, opening, balance ?? opening, asOf, txns)] };
}
