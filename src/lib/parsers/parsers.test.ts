import { describe, expect, it } from "vitest";
import { parseEmail } from ".";
import { categorise } from "../categorise";
import { htmlToText } from "./util";

const received = (iso: string) => new Date(iso);

const OCBC_PAYNOW_UEN = `Dear Valued Customer

The following PayNow transfer has been made to 100 BBT using their Unique Entity Number (UEN) 00000000X.

Date\t: 27 Oct 2026
Time\t: 16:51 PM SGT
Amount\t: SGD 1.80
From your account\t: OCBC FRANK Account (-000001)
Description\t: OTHR
Reference number\t: 2610270100000001
If you have any questions, please call our Personal Banking hotline: OCBC website > Contact us.

Thank you for banking with us. We look forward to serving you again.

Tip: To subscribe or change your settings for e-Alerts, log in to OCBC Internet Banking > Customer Service (on the top navigation bar) > Manage e-Alerts.`;

const OCBC_PAYNOW_AM = `The following PayNow transfer has been made to FOMO PAY PTE. LTD. using their Unique Entity Number (UEN) 000000000X000.

Date\t: 26 Oct 2026
Time\t: 00:47 AM SGT
Amount\t: SGD 7.00
From your account\t: OCBC FRANK Account (-000001)
Description\t: QY00000000000000000001
Reference number\t: 2610260100000002
OCBC`;

const OCBC_EPACKET = `Dear Valued Customer

The following Deepavali e-Packet has been sent via the OCBC app:

To: JANE TAN using his/her mobile number (+******0000)
Date: 26 Oct 2026
Time: 22:28 PM
Amount: SGD 8.62
From your account: OCBC FRANK Account (-000001)
Reference number: 2610260100000003

Digital Business
OCBC`;

const OCBC_CARD = `Dear Valued Customer

We wish to inform you that SGD764.40 was charged at 01:14 on 18-Sep-26 to your card (-0000) at Trip.com Singapore SG.

Did not make this transaction?
- Lock your card and/or report it as lost: OCBC app > More > Card Services > Lock/unlock card and/or Report lost card.

Group Lifestyle Financing
OCBC`;

const OCBC_STATEMENT = `Dear Valued Customer
You may now view or download the latest monthly e-Statement for your deposit account. Simply log in to OCBC app > Tap "More" at the bottom navigation bar > View documents.`;

const PAYLAH = `Transaction Ref: PLPE0000000000000001

Dear Sir / Madam,
We refer to your PayLah! Scan & Pay Transfer dated 26 Oct. We are pleased to confirm that the transaction was completed.

Date & Time:\t26 Oct 19:25 (SGT)
Amount:\tSGD1.60
From:\tPayLah! Wallet (Mobile ending 0000)
To:\tDRINKS AND SNACK

Please call DBS hotline immediately if this was an unauthorised transaction.

Yours faithfully
DBS Bank Ltd`;

const PAYLAH_TO_PERSON = `Transaction Ref: TF000000000000000001

Dear Sir / Madam,
We refer to your PayLah! Transfer dated 31 Oct. We are pleased to confirm that the transaction was completed.

Date & Time:\t31 Oct 11:49 (SGT)
Amount:\tSGD3.20
From:\tPayLah! Wallet (Mobile ending 0000)
To:\tBBT (Mobile ending 0000)

To view your transactions, login to your PayLah! Wallet and select “History” at the bottom bar of the Home page. To manage your PayLah! notifications, select “Settings” then “Manage Notifications”.

Please call DBS hotline immediately if this was an unauthorised transaction.

Yours faithfully
DBS Bank Ltd`;

const OCBC_PAYNOW_FULL = `Dear Valued Customer

The following PayNow transfer has been made to AB FOOD CENTRE PTE LTD using their Unique Entity Number (UEN) 000000000X0XX.

Date\t: 01 Nov 2026
Time\t: 14:46 PM SGT
Amount\t: SGD 4.50
From your account\t: OCBC FRANK Account (-000001)
Description\t: PNS0000000000000000001
Reference number\t: 2611010100000004
If you have any questions, please call our Personal Banking hotline: OCBC website > Contact us.

Thank you for banking with us. We look forward to serving you again.

Yours sincerely

Digital Business
Global Consumer Financial Services
OCBC

Tip: To subscribe or change your settings for e-Alerts, log in to OCBC Internet Banking > Customer Service (on the top navigation bar) > Manage e-Alerts.

Do allow us to warn you against phishing attempts involving e-mails that claim to be from OCBC. We will not send you any emails with links requesting your Access Code, PIN or One-time Password.`;


// HTML alerts put each value on the line after its label
const PAYLAH_HTML = `Transaction Alerts
 Problems viewing this email? Select ""always display images"". 


 Transaction Ref: PLPE0000000000000002	


 Dear Sir / Madam, 

We refer to your PayLah! Scan & Pay Transfer dated 14 May. We are pleased to confirm that the transaction was completed. 

Date & Time:	
14 May 11:24 (SGT)	



Amount:	
SGD2.00	



From:	
PayLah! Wallet (Mobile ending 0000)	



To:	
LHC 000 CENTRAL	


 To view your transactions, login to your PayLah! Wallet and select &ldquo;History&rdquo; at the bottom bar of the Home page.
 Yours faithfully
 DBS Bank Ltd `;

const OCBC_FUNDS_TRANSFER = `We have processed your funds transfer requestDear Valued Customer
We have received your request to make the following transfer:
Date of Transfer	:	14 May 2026	
Time of Transfer	:	11.14 AM SGT	
Amount	:	SGD 300.00	
From your account	:	OCBC FRANK Account (-000001)	
To account	:	Jane (-000002) at DBS BANK LTD	
Reference number	:	0000000000000001	
You can log in to OCBC Online Banking and select Customer Service > Check internet transaction status to check the status of this transfer.
Yours sincerely
OCBC`;

const OCBC_ATM = `Dear Valued Customer

SGD 10.00 was withdrawn from your OCBC FRANK Account (-000001) using the OCBC app at an OCBC ATM. This was done at 20:58 on 14 May 2026.

Yours sincerely
OCBC`;

const DBS_RECEIVED = ` &zwnj; &zwnj; &zwnj;
  Transactional Alerts
        digibank Alerts - You've received a transfer

		Transaction Ref: 000000000000000001EPS0000000

		Dear Customer,

		You have received SGD 300.00 via FAST transfer on 14 May 2026 11:14  SGT. 

			 From: JANE TAN

            To: Your DBS/ POSB account ending 0002

Didn’t expect these funds? If this is a joint account, it may be for your joint account holder. Otherwise, please call our DBS hotline.

Yours faithfully

DBS Bank Ltd`;

describe("OCBC", () => {
  it("parses the full PayNow alert including footer text", () => {
    const r = parseEmail({ from: "Notifications@ocbc.com", text: OCBC_PAYNOW_FULL, receivedAt: received("2026-11-01T06:46:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      merchant: "AB FOOD CENTRE PTE LTD",
      amountCents: 450,
      occurredAt: "2026-11-01T14:46:00+08:00",
      reference: "2611010100000004",
      payeeType: "business",
    });
  });

  it("parses PayNow to UEN and fixes '16:51 PM'", () => {
    const r = parseEmail({ text: OCBC_PAYNOW_UEN, receivedAt: received("2026-10-27T08:52:00Z") });
    expect(r).toEqual({
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: "paynow",
        direction: "debit",
        amountCents: 180,
        currency: "SGD",
        occurredAt: "2026-10-27T16:51:00+08:00",
        merchant: "100 BBT",
        account: "OCBC FRANK Account (-000001)",
        reference: "2610270100000001",
        description: "OTHR",
        payeeType: "business",
      },
    });
  });

  it("parses 00:47 AM as just after midnight", () => {
    const r = parseEmail({ text: OCBC_PAYNOW_AM, receivedAt: received("2026-10-25T16:48:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      merchant: "FOMO PAY PTE. LTD.",
      amountCents: 700,
      occurredAt: "2026-10-26T00:47:00+08:00",
      reference: "2610260100000002",
    });
  });

  it("parses e-Packet as a transfer to a person", () => {
    const r = parseEmail({ text: OCBC_EPACKET, receivedAt: received("2026-10-26T14:28:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      kind: "transfer",
      merchant: "JANE TAN",
      payeeType: "person",
      amountCents: 862,
      occurredAt: "2026-10-26T22:28:00+08:00",
      description: "Deepavali e-Packet",
      reference: "2610260100000003",
    });
  });

  it("parses card charge", () => {
    const r = parseEmail({ text: OCBC_CARD, receivedAt: received("2026-09-17T17:14:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      kind: "card",
      merchant: "Trip.com Singapore SG",
      amountCents: 76440,
      occurredAt: "2026-09-18T01:14:00+08:00",
      account: "OCBC Card (-0000)",
      reference: null,
    });
  });

  it("ignores e-Statement notices", () => {
    expect(parseEmail({ text: OCBC_STATEMENT, receivedAt: new Date() })).toEqual({
      status: "ignored",
      reason: "statement_notice",
    });
  });
});

describe("DBS PayLah!", () => {
  it("parses Scan & Pay and infers year", () => {
    const r = parseEmail({ text: PAYLAH, receivedAt: received("2026-10-26T11:26:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      source: "dbs_paylah",
      kind: "ewallet",
      merchant: "DRINKS AND SNACK",
      amountCents: 160,
      occurredAt: "2026-10-26T19:25:00+08:00",
      reference: "PLPE0000000000000001",
      payeeType: "business",
    });
  });

  it("parses a transfer to a person's phone number", () => {
    const r = parseEmail({ text: PAYLAH_TO_PERSON, receivedAt: received("2026-10-31T03:50:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      merchant: "BBT",
      payeeType: "person",
      amountCents: 320,
      occurredAt: "2026-10-31T11:49:00+08:00",
      reference: "TF000000000000000001",
      account: "PayLah! Wallet",
    });
  });

  it("rolls back to previous year for late-December txn received in January", () => {
    const text = PAYLAH.replace(/26 Oct/g, "31 Dec");
    const r = parseEmail({ text, receivedAt: received("2027-01-01T02:00:00Z") });
    expect(r.status === "parsed" && r.txn.occurredAt).toBe("2026-12-31T19:25:00+08:00");
  });
});


it("parses HTML-only alerts after conversion", () => {
  const html = `<table><tr><td>Date</td><td>: 27 Oct 2026</td></tr><tr><td>Time</td><td>: 16:51 PM SGT</td></tr><tr><td>Amount</td><td>: SGD 1.80</td></tr><tr><td>From your account</td><td>: OCBC FRANK Account (-000001)</td></tr><tr><td>Reference number</td><td>: 261027</td></tr></table>`;
  const text = `<p>The following PayNow transfer has been made to 100 BBT using their Unique Entity Number (UEN) 00000000X.</p>${html}<p>OCBC</p>`;
  const r = parseEmail({ text: htmlToText(text), receivedAt: new Date() });
  expect(r.status === "parsed" && r.txn).toMatchObject({ merchant: "100 BBT", amountCents: 180, reference: "261027" });
});


it("returns unrecognised for unrelated emails", () => {
  expect(parseEmail({ text: "Hello, your parcel has shipped", receivedAt: new Date() }).status).toBe("unrecognised");
});

describe("more alert formats", () => {
  it("reads PayLah! alerts whose values sit on the next line", () => {
    const r = parseEmail({ text: PAYLAH_HTML, receivedAt: received("2026-05-14T03:25:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      merchant: "LHC 000 CENTRAL",
      amountCents: 200,
      occurredAt: "2026-05-14T11:24:00+08:00",
      reference: "PLPE0000000000000002",
      account: "PayLah! Wallet",
    });
  });

  it("parses an OCBC transfer to another bank, with a dotted time", () => {
    const r = parseEmail({ text: OCBC_FUNDS_TRANSFER, from: "Notifications@ocbc.com", receivedAt: received("2026-05-14T03:15:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      kind: "transfer",
      direction: "debit",
      merchant: "Jane",
      amountCents: 30000,
      occurredAt: "2026-05-14T11:14:00+08:00",
      account: "OCBC FRANK Account (-000001)",
      reference: "0000000000000001",
      description: "Transfer to DBS BANK LTD (-000002)",
    });
  });

  it("parses an OCBC ATM withdrawal as cash", () => {
    const r = parseEmail({ text: OCBC_ATM, from: "Notifications@ocbc.com", receivedAt: received("2026-05-14T13:00:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      kind: "atm",
      merchant: "OCBC ATM",
      amountCents: 1000,
      occurredAt: "2026-05-14T20:58:00+08:00",
      account: "OCBC FRANK Account (-000001)",
    });
    expect(r.status === "parsed" && categorise(r.txn)).toBe("Cash");
  });

  it("parses money received into a DBS account, labelled like the statement", () => {
    const r = parseEmail({ text: DBS_RECEIVED, from: "ibanking.alert@dbs.com", receivedAt: received("2026-05-14T03:15:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      source: "dbs",
      kind: "transfer",
      direction: "credit",
      merchant: "JANE TAN",
      amountCents: 30000,
      occurredAt: "2026-05-14T11:14:00+08:00",
      account: "DBS/POSB (-0002)",
      reference: "000000000000000001EPS0000000",
    });
    expect(r.status === "parsed" && categorise(r.txn, [], ["JANE TAN"])).toBe("Own transfers");
  });
});

describe("OCBC PayNow to a mobile number", () => {
  const alert = (verb: string) => `Dear Valued Customer

The following PayNow transfer ${verb} to JANE             (TAN JXXX using his/her Mobile (+******0000).

Date	: 30 May 2026	
Time	: 13:23 PM SGT	
Amount	: SGD 5.00	
From your account	: OCBC FRANK Account (-000001)	
Description	: dinner share	
Reference number	: 0000000000000003	

OCBC`;

  it("parses it as a transfer to a person, tidying the name", () => {
    const r = parseEmail({ text: alert("has been made"), from: "Notifications@ocbc.com", receivedAt: received("2026-05-30T05:24:00Z") });
    expect(r.status === "parsed" && r.txn).toMatchObject({
      kind: "paynow",
      merchant: "JANE (TAN JXXX",
      payeeType: "person",
      amountCents: 500,
      occurredAt: "2026-05-30T13:23:00+08:00",
      description: "dinner share",
    });
  });

  it("ignores one that failed", () => {
    const r = parseEmail({ text: alert("could not be made"), from: "Notifications@ocbc.com", receivedAt: received("2026-05-30T05:24:00Z") });
    expect(r).toEqual({ status: "ignored", reason: "failed_transfer" });
  });
});

it("parses an OCBC NETS QR alert and labels the account like the statement", () => {
  const text = `Dear Valued Customer

The following NETS QR payment has been made:

Date	:	20 Mar 2026
Time	:	11:35
Amount	:	SGD 5.30
From your account	:	FRANK Account (-000001)
To	:	NOODLE   STALL
NETS merchant ID	:	00000000000
NETS Stan ID	:	000000
Reference number	:	0000000000000004

OCBC`;
  const r = parseEmail({ text, from: "Notifications@ocbc.com", receivedAt: received("2026-03-20T03:36:00Z") });
  expect(r.status === "parsed" && r.txn).toMatchObject({
    kind: "nets",
    merchant: "NOODLE STALL",
    amountCents: 530,
    occurredAt: "2026-03-20T11:35:00+08:00",
    account: "OCBC FRANK Account (-000001)",
    reference: "0000000000000004",
  });
});
