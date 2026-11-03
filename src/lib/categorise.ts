import type { ParsedTxn, TxnDirection } from "./parsers";

export const DEFAULT_CATEGORIES = [
  "Food & Drinks",
  "Groceries",
  "Transport",
  "Travel",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Subscriptions",
  "Health",
  "Gifts",
  "Transfers",
  "Cash",
  "Uncategorised",
  // Money in
  "Income",
  "Allowance",
  "Paid back",
  "Refunds",
  "Interest & rebates",
  // Neither spending nor income
  "Own transfers",
] as const;

/** Money in that you earned or were given. Counts as income. */
export const EARNED = ["Income", "Allowance", "Interest & rebates"];
/** Money in that gives back what you spent: a friend paying you back, a shop refund, a failed transfer returned. */
export const RETURNED = ["Paid back", "Refunds"];
export const MONEY_IN: readonly string[] = [...EARNED, ...RETURNED];

/** Names that are businesses, not people. A payment in from a business is a refund, from a person it's being paid back. */
const BUSINESS = /\b(PTE|LTD|LLP|INC|CORP|SINGAPORE|SHOPEE|LAZADA|GRAB|AMAZON|HEALTH|CLINIC|HOSPITAL|INSURANCE|BANK|MART|STORE|SHOP|SERVICES|PG)\b|\.COM|\d/i;

/** Services that charge on a schedule. Exported so existing rows can be moved over once. */
export const SUBSCRIPTION =
  /\b(ANTHROPIC|CLAUDE\.AI|OPENAI|CHATGPT|NETFLIX|SPOTIFY|DISNEY|YOUTUBE ?PREMIUM|APPLE\.COM|ICLOUD|GOOGLE ?(ONE|STORAGE)|NOTION|CANVA|ADOBE|MICROSOFT|GITHUB|DROPBOX|PATREON|AMAZON ?PRIME)\b/i;

const KEYWORD_RULES: [RegExp, string][] = [
  [/\b(BBT|BUBBLE ?TEA|KOI|LIHO|CHICHA|GONG ?CHA|DRINKS?|SNACKS?|KOPI|COFFEE|CAFE|STARBUCKS|TOAST|MCDONALD|KFC|BURGER|PIZZA|SUBWAY|FOOD|RESTAURANT|EATERY|KITCHEN|NOODLES?|MIAN|BAK ?KUT|HAWKER|KOUFU|KOPITIAM|FOOD ?REPUBLIC|FOMO ?PAY|DELIVEROO|FOODPANDA)\b/i, "Food & Drinks"],
  [/\b(NTUC|FAIRPRICE|SHENG ?SIONG|COLD ?STORAGE|GIANT|DON ?DON ?DONKI|PRIME ?SUPERMARKET)\b/i, "Groceries"],
  [/\b(GRAB|GOJEK|COMFORT ?DELGRO|CDG|TADA|RYDE|SIMPLYGO|BUS\/MRT|TRANSITLINK|EZ-?LINK|SMRT|SBS ?TRANSIT|SHELL|ESSO|CALTEX|SPC)\b/i, "Transport"],
  [/\b(TRIP\.?COM|AGODA|BOOKING\.?COM|EXPEDIA|AIRBNB|KLOOK|AIRASIA|SCOOT|SINGAPORE AIRLINES|JETSTAR|HOTEL)\b/i, "Travel"],
  [/\b(SHOPEE|LAZADA|AMAZON|TAOBAO|QOO10|UNIQLO|IKEA|DAISO|WATSONS|GUARDIAN|POPULAR)\b/i, "Shopping"],
  [/\b(SINGTEL|STARHUB|M1|CIRCLES|GIGA|SP ?GROUP|SP ?SERVICES|TOWN ?COUNCIL|INSURANCE|PRUDENTIAL|AIA|GREAT EASTERN|INCOME)\b/i, "Bills & Utilities"],
  [SUBSCRIPTION, "Subscriptions"],
  [/\b(YOUTUBE|GOOGLE ?PLAY|STEAM|GV|SHAW|CATHAY|GOLDEN ?VILLAGE)\b/i, "Entertainment"],
  [/\bATM\b/i, "Cash"],
  [/\b(CLINIC|POLYCLINIC|HOSPITAL|PHARMACY|DENTAL|MEDICAL)\b/i, "Health"],
];

export function normaliseMerchant(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/\b(PTE\.?|LTD\.?|LIMITED|PRIVATE|SINGAPORE|SG)\b/g, " ")
    .replace(/[^A-Z0-9&.' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface UserRule {
  merchantKey: string;
  category: string;
}

/** Money moving between your own accounts and wallets. Not spending, not income. */
const OWN_TRANSFER = /TOP-?UP TO PAYLAH|MAXED OUT FROM PAYLAH|PayLah! top-up/i;

/** Whole-word match on any of your names, so "JANE TAN" catches "JANE TAN WEI" but "TAN" doesn't catch "TANJONG". */
export function isOwnName(merchant: string, ownNames: string[]): boolean {
  const key = normaliseMerchant(merchant);
  return ownNames.some((n) => n.trim() && ` ${key} `.includes(` ${normaliseMerchant(n)} `));
}

/** What a payment coming in is, when no rule of yours says otherwise. */
function moneyIn(txn: Pick<ParsedTxn, "merchant" | "description" | "payeeType">, allowanceNames: string[]): string {
  const hay = `${txn.merchant} ${txn.description ?? ""}`;
  if (isOwnName(txn.merchant, allowanceNames)) return "Allowance";
  if (/INTEREST|REBATE|BOOSTER|CASHBACK/i.test(hay)) return "Interest & rebates";
  if (/REVERS|REFUND|RETURNED/i.test(hay)) return "Refunds";
  if (/\b(GOV|MINDEF|SAF|SALARY|PAYROLL|IRAS|CPF)\b/i.test(hay)) return "Income";
  if (txn.payeeType === "business" || BUSINESS.test(txn.merchant)) return "Refunds";
  if (txn.payeeType === "person" || /^[A-Za-z ,.'-]+$/.test(txn.merchant.trim())) return "Paid back";
  return "Income";
}

export function categorise(
  txn: Pick<ParsedTxn, "merchant" | "description" | "payeeType" | "kind"> & { direction?: TxnDirection },
  userRules: UserRule[] = [],
  ownNames: string[] = [],
  allowanceNames: string[] = [],
): string {
  const key = normaliseMerchant(txn.merchant);
  const userHit = userRules.find((r) => r.merchantKey === key);
  if (userHit) return userHit.category;

  const hay = `${txn.merchant} ${txn.description ?? ""}`;
  if (OWN_TRANSFER.test(hay)) return "Own transfers";
  if (isOwnName(txn.merchant, ownNames)) return "Own transfers";
  if (txn.direction === "credit") return moneyIn(txn, allowanceNames);
  // OCBC labels every e-Packet with a festive theme ("Deepavali e-Packet") even for a plain
  // transfer, so it says nothing about gifts. Only your own words do.
  if (/\b(ang ?bao|hong ?bao|gift|birthday|wedding)\b/i.test(txn.description ?? "") && txn.kind !== "card") return "Gifts";
  for (const [re, cat] of KEYWORD_RULES) if (re.test(hay)) return cat;
  if (txn.payeeType === "person") return "Transfers";
  return "Uncategorised";
}

/** Stable key so the same email alert is never recorded twice. */
export function dedupKey(txn: Pick<ParsedTxn, "source" | "reference" | "occurredAt" | "amountCents" | "merchant">): string {
  if (txn.reference) return `${txn.source}:ref:${txn.reference}`;
  return `${txn.source}:${txn.occurredAt.slice(0, 16)}:${txn.amountCents}:${normaliseMerchant(txn.merchant)}`;
}
