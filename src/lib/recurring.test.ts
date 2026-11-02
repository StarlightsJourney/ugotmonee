import { describe, expect, it } from "vitest";
import { describeEvery, findRecurring, groupKey, type Spend } from "./recurring";

const DAY = 86_400_000;
const at = (d: string) => Date.parse(`${d}T00:00:00+08:00`);
const spend = (d: string, merchant: string, amount: number, category = "Food & Drinks"): Spend => ({ at: at(d), merchant, merchantKey: merchant, amount, category });

describe("recurring payments", () => {
  it("groups past statement truncation and reference numbers", () => {
    expect(groupKey("CITY DENTAL CLINIC")).toBe(groupKey("CITY DENTAL CLIN"));
    expect(groupKey("BUS/MRT 900000001")).toBe("BUS/MRT");
    expect(groupKey("ACME DRIVING CENTRE")).toBe(groupKey("ACME DRIVING"));
  });

  it("names common intervals", () => {
    expect([7, 14, 30, 91, 365, 21].map(describeEvery)).toEqual(["week", "2 weeks", "month", "3 months", "year", "~3 weeks"]);
  });

  it("finds a steady monthly charge but not a daily habit", () => {
    const s = [
      ...["03-05", "04-09", "05-10", "06-10", "07-10", "08-10"].map((d) => spend(`2026-${d}`, "PHONE PLAN CO", 10.1, "Bills & Utilities")),
      ...["09-01", "09-02", "09-05", "09-06", "09-20", "09-21", "09-22"].map((d) => spend(`2026-${d}`, "BUBBLE TEA", 1.8)),
    ];
    const r = findRecurring(s, at("2026-10-20"), at("2026-10-01"));
    expect(r.map((x) => x.merchant)).toEqual(["PHONE PLAN CO"]);
    expect(r[0]).toMatchObject({ kind: "Subscription", every: "month", times: 6, overdue: true });
    expect(r[0].perMonth).toBeCloseTo(10.1, 0);
  });

  it("keeps the usual charge and ignores the odd different amount", () => {
    const s = ["03-31", "04-30", "05-31", "06-30"].map((d) => spend(`2026-${d}`, "CLINIC", 88, "Health"));
    s.push(spend("2026-05-02", "CLINIC", 2, "Health"));
    const [r] = findRecurring(s, at("2026-07-10"), at("2026-07-01"));
    expect(r).toMatchObject({ amount: 88, times: 4, kind: "Regular payment", overdue: false });
    expect(r.nextExpected! - r.last).toBeGreaterThan(29 * DAY);
  });

  it("drops a series that ended long ago, and a monthly clinic visit with one odd gap still counts", () => {
    const old = ["01-10", "02-10", "03-10"].map((d) => spend(`2026-${d}`, "DRIVING SCHOOL", 200, "Transport"));
    expect(findRecurring(old, at("2026-11-03"), at("2026-10-01"))).toEqual([]);
    const clinic = ["03-31", "07-06", "07-28", "08-26", "09-30", "10-06"].map((d) => spend(`2026-${d}`, "TCM CLINIC", 88, "Health"));
    expect(findRecurring(clinic, at("2026-11-03"), at("2026-10-01"))[0]).toMatchObject({ every: "month", times: 6 });
  });

  it("doesn't call it missing before the statement that would show it", () => {
    const s = ["03-10", "04-10", "05-10"].map((d) => spend(`2026-${d}`, "PHONE PLAN CO", 10.1, "Bills & Utilities"));
    expect(findRecurring(s, at("2026-07-03"), at("2026-06-01"))[0].overdue).toBe(false);
  });
});
