import { describe, expect, it } from "vitest";
import { findMatch, isGeneric } from "./match";

const at = (d: string) => Date.parse(d);
const stmt = { id: 1, at: at("2026-05-14T00:00:00+08:00"), amountCents: 30000, direction: "credit" as const, merchantKey: "FAST PAYMENT RECEIPT", account: "DBS/POSB (-0002)" };

describe("matching a statement line with no payee", () => {
  it("knows bank wording from a name", () => {
    expect(isGeneric("FAST PAYMENT RECEIPT")).toBe(true);
    expect(isGeneric("JANE TAN")).toBe(false);
  });

  it("merges on the same account and day when it's the only candidate", () => {
    const alert = { at: at("2026-05-14T11:14:00+08:00"), amountCents: 30000, direction: "credit" as const, merchantKey: "JANE TAN", account: "DBS/POSB (-0002)" };
    expect(findMatch(alert, [stmt], new Set())?.id).toBe(1);
  });

  it("doesn't guess when two lines could be it, or the account differs", () => {
    const alert = { at: at("2026-05-14T11:14:00+08:00"), amountCents: 30000, direction: "credit" as const, merchantKey: "JANE TAN", account: "DBS/POSB (-0002)" };
    expect(findMatch(alert, [stmt, { ...stmt, id: 2 }], new Set())).toBeNull();
    expect(findMatch({ ...alert, account: "OCBC FRANK Account (-000001)" }, [stmt], new Set())).toBeNull();
  });
});
