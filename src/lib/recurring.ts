// Spot payments that come round on a schedule: subscriptions, phone plans, a monthly appointment.
// Everyday habits (the same coffee most days) don't count: food and groceries are left out,
// and other series need a steady gap of two weeks or more.

const DAY = 86_400_000;

export interface Spend {
  at: number;
  merchant: string;
  merchantKey: string;
  amount: number;
  category: string;
}

export interface Recurring {
  merchant: string;
  category: string;
  amount: number;
  everyDays: number;
  every: string;
  times: number;
  first: number;
  last: number;
  nextExpected: number | null;
  perMonth: number;
  kind: "Subscription" | "Regular payment";
  /** Expected by now but missing from an imported statement. */
  overdue: boolean;
}

/** Categories where a fixed monthly charge is a subscription rather than, say, a clinic visit. */
const SUBSCRIPTION_LIKE = new Set(["Subscriptions", "Bills & Utilities", "Entertainment"]);
/** Bought often at similar prices, so they look regular without being commitments. */
const HABITS = new Set(["Food & Drinks", "Groceries"]);
const MIN_AMOUNT = 3;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Statements cut merchant names short and add reference numbers, and the same payee can be
 * "ACME DRIVING" on one line and "ACME DRIVING CENTRE" on another; group past all three.
 */
export function groupKey(merchantKey: string) {
  return merchantKey.replace(/\b\d[\d ]*\b/g, " ").replace(/\s+/g, " ").trim().slice(0, 12).trim();
}

export function describeEvery(days: number) {
  if (days >= 6 && days <= 8) return "week";
  if (days >= 13 && days <= 16) return "2 weeks";
  if (days >= 26 && days <= 35) return "month";
  if (days >= 85 && days <= 95) return "3 months";
  if (days >= 350 && days <= 380) return "year";
  return days < 26 ? `~${Math.round(days / 7)} weeks` : `~${Math.round(days / 30.4)} months`;
}

/**
 * @param coveredUntil the end of the latest imported statement. Card payments only show up
 * in statements, so something is only "missing" if its expected date falls before this.
 */
export function findRecurring(spends: Spend[], now: number, coveredUntil: number): Recurring[] {
  const groups = new Map<string, Spend[]>();
  for (const s of spends) {
    const k = groupKey(s.merchantKey);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  const out: Recurring[] = [];
  for (const all of groups.values()) {
    // The same charge each time: within 10% of the usual amount
    const usual = median(all.map((s) => s.amount));
    const series = all.filter((s) => Math.abs(s.amount - usual) <= usual * 0.1).sort((a, b) => a.at - b.at);
    const latest = series[series.length - 1] ?? all[all.length - 1];
    const days = [...new Set(series.map((s) => Math.floor(s.at / DAY)))];
    const subscription = latest.category === "Subscriptions";

    if (days.length < 3) {
      // A known subscription service is worth listing even before it has repeated
      if (subscription && now - latest.at < 90 * DAY) out.push(entry(series.length ? series : all, null, true, now, coveredUntil));
      continue;
    }
    if (!subscription && (HABITS.has(latest.category) || usual < MIN_AMOUNT)) continue;
    const gaps = days.slice(1).map((d, i) => d - days[i]);
    const gap = median(gaps);
    // Most gaps near the usual one; a single doubled-up or skipped month is fine
    const steady = gaps.filter((g) => Math.abs(g - gap) <= gap * 0.4).length / gaps.length;
    if (gap < 14 || steady < 0.6) continue;
    // Long finished, like a course of lessons: not worth listing
    if (now - latest.at > Math.max(90, gap * 3) * DAY) continue;
    out.push(entry(series, gap, subscription, now, coveredUntil));
  }
  return out.sort((a, b) => b.perMonth - a.perMonth);
}

function entry(series: Spend[], gap: number | null, subscription: boolean, now: number, coveredUntil: number): Recurring {
  const latest = series[series.length - 1];
  const amount = median(series.map((s) => s.amount));
  const fixed = series.every((s) => Math.abs(s.amount - amount) < 0.01);
  const next = gap ? latest.at + gap * DAY : null;
  return {
    merchant: latest.merchant,
    category: latest.category,
    amount,
    everyDays: gap ?? 0,
    every: gap ? describeEvery(gap) : "seen once",
    times: series.length,
    first: series[0].at,
    last: latest.at,
    nextExpected: next,
    perMonth: gap ? (amount * 30.4) / gap : subscription ? amount : 0,
    kind: subscription || (fixed && gap !== null && gap >= 26 && SUBSCRIPTION_LIKE.has(latest.category)) ? "Subscription" : "Regular payment",
    // A week's grace, or a third of the interval for longer ones
    overdue: next !== null && gap !== null && next + Math.max(7, gap / 3) * DAY < Math.min(now, coveredUntil),
  };
}
