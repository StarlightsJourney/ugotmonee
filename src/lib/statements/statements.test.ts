import { describe, expect, it } from "vitest";
import { findMatch } from "../match";
import { normaliseMerchant } from "../categorise";
import { itemsToLines, parseStatement } from ".";

// Layout as itemsToLines produces it from the real PDFs. Every name, number
// and merchant here is made up.
const OCBC = `
                                                                                    OCBC Bank
          JANE TAN                                                                  STATEMENT OF ACCOUNT
          OCBC FRANK ACCOUNT                                                        1 DEC 2026 TO 31 JAN 2027
          Account No. 000000000001
          Transaction      Value
          Date             Date             Description                         Cheque        Withdrawal         Deposit          Balance
                                            BALANCE B/F                                                                           1,000.00
          30 DEC           30 DEC           FAST PAYMENT                                            4.00                            996.00
                                            via PayNow-UEN
                                            to SUNSET TRADITION
                                            OTHR-T00XX0000X
          31 DEC           31 DEC           DEBIT PURCHASE                                          5.05                            990.95
                                            29/12/26
                                            xx-0000 COLD STORAGE-ABC
                                            S
                                                                                                                   Oversea-Chinese Banking Corporation Limited
                                            049
          02 JAN           02 JAN           NETS QR                                                 1.10                            989.85
                                            000000000000000
                                            NETS QR PURCHASE
                                            DRINK STALL GARDENS
          03 JAN           03 JAN           FAST PAYMENT                                                          600.00          1,589.85
                                            via PayNow-Mobile
                                            from JOHN LIM
          04 JAN           04 JAN           CCY CONVERSION FEE                                      0.84                          1,589.01
                                            FOR: 30.00 SGD
                                            BALANCE C/F                                                                           1,589.01
`.split("\n");

const DBS = `
                     Consolidated Statement
                     DBS Co. Reg. No. 000000000E
                     Transaction Details as at 31 Jul 2026
                     My Account                                                   Account No. 000-000000-0
                     Date           Description                         Withdrawal (-)      Deposit (+)      Balance
                                    Balance Brought Forward                                                 SGD 30.00
                     24/07/2026     Advice Funds Transfer                                          8.80        38.80
                                    MAXED OUT FROM PAYLAH! :
                                    JOHN LIM
                     28/07/2026     Advice Funds Transfer               25.00                                  13.80
                                    TOP-UP TO PAYLAH! :
                                    JANE
                     31/07/2026                                                                                13.80
                                    Total Balance Carried Forward in SGD:   25.00          8.80         13.80
`.split("\n");

describe("OCBC statement", () => {
  const st = parseStatement(OCBC)!;

  it("reads every line and the totals add up", () => {
    expect(st.bank).toBe("OCBC");
    expect(st.txns).toHaveLength(5);
    expect(st.accounts).toEqual([
      expect.objectContaining({ account: "OCBC FRANK Account (-000001)", openingCents: 100000, closingCents: 158901, asOf: "2027-01-31", balanced: true }),
    ]);
  });

  it("takes year from the statement period across December/January", () => {
    expect(st.txns.map((t) => t.occurredAt.slice(0, 10))).toEqual(["2026-12-30", "2026-12-29", "2027-01-02", "2027-01-03", "2027-01-04"]);
  });

  it("pulls merchant, kind and direction from each type", () => {
    expect(st.txns.map((t) => [t.kind, t.direction, t.merchant, t.payeeType])).toEqual([
      ["paynow", "debit", "SUNSET TRADITION", "business"],
      ["card", "debit", "COLD STORAGE-ABC", "business"],
      ["nets", "debit", "DRINK STALL GARDENS", "business"],
      ["paynow", "credit", "JOHN LIM", "person"],
      ["other", "debit", "CCY CONVERSION FEE", "unknown"],
    ]);
  });

  it("ignores page footers between transactions", () => {
    expect(st.txns[1].description).not.toMatch(/Oversea|049/);
  });

  it("gives each line a stable key", () => {
    expect(new Set(parseStatement(OCBC)!.txns.map((t) => t.stmtKey))).toEqual(new Set(st.txns.map((t) => t.stmtKey)));
    expect(new Set(st.txns.map((t) => t.stmtKey)).size).toBe(5);
  });

  it("flags a statement whose totals don't add up", () => {
    const missing = OCBC.filter((l) => !/02 JAN/.test(l));
    expect(parseStatement(missing)!.accounts[0].balanced).toBe(false);
  });
});

describe("DBS/POSB statement", () => {
  const st = parseStatement(DBS)!;

  it("reads transfers and checks the balance", () => {
    expect(st.bank).toBe("DBS");
    expect(st.txns.map((t) => [t.direction, t.amountCents, t.merchant])).toEqual([
      ["credit", 880, "JOHN LIM"],
      ["debit", 2500, "PayLah! top-up"],
    ]);
    expect(st.accounts[0]).toMatchObject({ account: "DBS/POSB (-0000)", closingCents: 1380, asOf: "2026-07-31", balanced: true });
  });
});

it("returns null for anything else", () => {
  expect(parseStatement(["Hello", "world"])).toBeNull();
});

it("rebuilds lines from PDF text positions", () => {
  const lines = itemsToLines([
    { str: "4.00", x: 400, y: 700, width: 16 },
    { str: "01 SEP", x: 40, y: 700.5, width: 24 },
    { str: "FAST PAYMENT", x: 176, y: 700, width: 60 },
    { str: "to SUNSET", x: 176, y: 688, width: 40 },
    { str: " TRADITION", x: 216, y: 688, width: 45 },
  ]);
  expect(lines).toEqual([`${" ".repeat(10)}01 SEP${" ".repeat(28)}FAST PAYMENT${" ".repeat(44)}4.00`, `${" ".repeat(44)}to SUNSET TRADITION`]);
});

describe("findMatch", () => {
  const day = (d: number, h = 0) => Date.parse(`2026-09-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00+08:00`);
  const email = (id: number, at: number, amountCents: number, merchant: string) => ({
    id,
    at,
    amountCents,
    direction: "debit" as const,
    merchantKey: normaliseMerchant(merchant),
  });
  const alerts = [
    email(0, day(19, 14), 450, "AB FOOD CENTRE PTE LTD"),
    email(1, day(19, 15), 450, "100 BBT"),
    email(2, day(17, 1), 76440, "Trip.com Singapore SG"),
  ];
  const line = (at: number, amountCents: number, merchant: string) => ({ at, amountCents, direction: "debit" as const, merchantKey: normaliseMerchant(merchant) });

  it("matches a truncated statement name to its alert", () => {
    expect(findMatch(line(day(19), 450, "AB FOOD CENTRE P"), alerts, new Set())?.id).toBe(0);
  });

  it("matches a card charge posted days later", () => {
    expect(findMatch(line(day(17), 76440, "Trip.com"), alerts, new Set())?.id).toBe(2);
  });

  it("won't guess between two same-amount payments with unrelated names", () => {
    expect(findMatch(line(day(19), 450, "SOMEWHERE ELSE"), alerts, new Set())).toBeNull();
  });

  it("won't reuse an alert already matched", () => {
    expect(findMatch(line(day(19), 450, "AB FOOD CENTRE P"), alerts, new Set([0]))).toBeNull();
  });

  it("won't match across more than three days", () => {
    expect(findMatch(line(day(23), 450, "AB FOOD CENTRE P"), alerts, new Set())).toBeNull();
  });
});
