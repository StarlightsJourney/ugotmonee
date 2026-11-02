import { describe, expect, it } from "vitest";
import { categorise, dedupKey, normaliseMerchant } from "./categorise";

const t = (merchant: string, extra: Partial<Parameters<typeof categorise>[0]> = {}) => ({
  merchant,
  description: null,
  payeeType: "business" as const,
  kind: "paynow" as const,
  ...extra,
});

describe("categorise", () => {
  it.each([
    ["100 BBT", "Food & Drinks"],
    ["DRINKS AND SNACK", "Food & Drinks"],
    ["FU LU SHOU SI MIAN FO PTE LTD", "Food & Drinks"],
    ["FOMO PAY PTE. LTD.", "Food & Drinks"],
    ["Trip.com Singapore SG", "Travel"],
    ["Some Random Co", "Uncategorised"],
  ])("%s -> %s", (merchant, cat) => expect(categorise(t(merchant))).toBe(cat));

  it("e-Packets are gifts, person payees are transfers", () => {
    expect(categorise(t("JANE TAN", { payeeType: "person", description: "Deepavali e-Packet" }))).toBe("Gifts");
    expect(categorise(t("JANE TAN", { payeeType: "person" }))).toBe("Transfers");
  });

  it("bus and train fares from statements are transport", () => {
    expect(categorise(t("BUS/MRT 000000000", { kind: "card" }))).toBe("Transport");
  });

  it("PayLah! top-ups and payments to your own name are own transfers", () => {
    expect(categorise(t("PayLah! top-up", { description: "TOP-UP TO PAYLAH! :" }))).toBe("Own transfers");
    expect(categorise(t("JANE TAN", { payeeType: "person" }), [], ["Jane Tan"])).toBe("Own transfers");
    expect(categorise(t("JANE TANNER", { payeeType: "person" }), [], ["Jane Tan"])).toBe("Transfers");
  });

  it("money in is income unless it's your own", () => {
    expect(categorise(t("INTEREST CREDIT", { direction: "credit" }))).toBe("Income");
  });

  it("user rules override defaults", () => {
    const rules = [{ merchantKey: normaliseMerchant("FOMO PAY PTE. LTD."), category: "Shopping" }];
    expect(categorise(t("FOMO PAY PTE. LTD."), rules)).toBe("Shopping");
  });
});

it("dedupKey prefers reference, falls back to time+amount+merchant", () => {
  const base = { source: "ocbc" as const, occurredAt: "2026-09-18T01:14:00+08:00", amountCents: 76440, merchant: "Trip.com Singapore SG" };
  expect(dedupKey({ ...base, reference: "123" })).toBe("ocbc:ref:123");
  expect(dedupKey({ ...base, reference: null })).toBe("ocbc:2026-09-18T01:14:76440:TRIP.COM");
});
