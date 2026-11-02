export type TxnSource = "ocbc" | "dbs" | "dbs_paylah";
export type TxnKind = "paynow" | "card" | "transfer" | "ewallet" | "nets" | "atm" | "other";
export type TxnDirection = "debit" | "credit";

export interface ParsedTxn {
  source: TxnSource;
  kind: TxnKind;
  direction: TxnDirection;
  amountCents: number;
  currency: string;
  occurredAt: string;
  merchant: string;
  account: string;
  reference: string | null;
  description: string | null;
  payeeType: "business" | "person" | "unknown";
}

export interface RawEmail {
  from?: string;
  subject?: string;
  text: string;
  receivedAt: Date;
}

export type ParseResult =
  | { status: "parsed"; txn: ParsedTxn }
  | { status: "ignored"; reason: string }
  | { status: "unrecognised" };
