import type { ParsedTxn } from "../parsers";

export interface StatementTxn extends ParsedTxn {
  /** Stable per statement line, so importing the same PDF twice adds nothing. */
  stmtKey: string;
}

export interface AccountCheck {
  account: string;
  openingCents: number;
  closingCents: number;
  /** Statement end date, yyyy-mm-dd: the closing balance is as of the end of this day. */
  asOf: string;
  debitCents: number;
  creditCents: number;
  /** opening - debits + credits == closing: no line was missed or misread. */
  balanced: boolean;
}

export interface Statement {
  bank: "OCBC" | "DBS";
  txns: StatementTxn[];
  accounts: AccountCheck[];
}
