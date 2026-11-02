import type { TxnDirection } from "./parsers";

/** A transaction already in the sheet that a new one might be the same as. */
export interface Candidate {
  id: number;
  at: number;
  amountCents: number;
  direction: TxnDirection;
  merchantKey: string;
  account?: string;
}

const DAY = 86_400_000;
const sgtDay = (ms: number) => Math.floor((ms + 8 * 3_600_000) / DAY);
const words = (key: string) => new Set(key.split(" ").filter((w) => w.length >= 3));

/** Bank wording with no payee in it, like DBS's "FAST Payment / Receipt". */
const BANK_WORDS = new Set(["FAST", "PAYMENT", "RECEIPT", "TRANSFER", "FUNDS", "FUND", "ADVICE", "PAYNOW", "GIRO", "INWARD", "INCOMING", "CREDIT", "IBG", "MEPS"]);
export const isGeneric = (key: string) => key.split(" ").every((w) => !w || BANK_WORDS.has(w));

/**
 * Find the email alert a statement line is the same payment as, or the other way round.
 * Statements only have the date and word merchants differently ("SUNSET TRADITION"
 * vs "SUNSET TRADITION PTE LTD"), so match on amount, a few days' window, and a
 * shared word in the merchant. When unsure, don't merge: a visible duplicate is
 * easier to spot and fix than a payment that silently disappeared.
 */
export function findMatch(t: Omit<Candidate, "id">, candidates: Candidate[], used: Set<number>): Candidate | null {
  const pool = candidates.filter(
    (c) => !used.has(c.id) && c.direction === t.direction && c.amountCents === t.amountCents && Math.abs(sgtDay(c.at) - sgtDay(t.at)) <= 3,
  );
  const mine = words(t.merchantKey);
  const named = pool.filter((c) => [...words(c.merchantKey)].some((w) => mine.has(w)));
  const best = named.sort((a, b) => Math.abs(a.at - t.at) - Math.abs(b.at - t.at))[0];
  if (best) return best;
  // One side names nobody: accept it only on the same account, within a day, with exactly one candidate
  const blind = pool.filter(
    (c) => (isGeneric(c.merchantKey) || isGeneric(t.merchantKey)) && c.account && c.account === t.account && Math.abs(sgtDay(c.at) - sgtDay(t.at)) <= 1,
  );
  return blind.length === 1 ? blind[0] : null;
}
