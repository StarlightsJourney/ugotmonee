// Built from src/gas by `pnpm build`. Don't edit by hand.
"use strict";
var ugotmonee = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/gas/main.ts
  var main_exports = {};
  __export(main_exports, {
    importStatement: () => importStatement,
    onEdit: () => onEdit,
    onOpen: () => onOpen,
    remindStatements: () => remindStatements,
    reviewMerchants: () => reviewMerchants,
    setGeminiKey: () => setGeminiKey,
    setup: () => setup,
    showImport: () => showImport,
    sync: () => sync,
    syncNow: () => syncNow,
    updateBalances: () => updateBalances
  });

  // src/lib/categorise.ts
  var DEFAULT_CATEGORIES = [
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
    "Own transfers"
  ];
  var EARNED = ["Income", "Allowance", "Interest & rebates"];
  var RETURNED = ["Paid back", "Refunds"];
  var MONEY_IN = [...EARNED, ...RETURNED];
  var BUSINESS = /\b(PTE|LTD|LLP|INC|CORP|SINGAPORE|SHOPEE|LAZADA|GRAB|AMAZON|HEALTH|CLINIC|HOSPITAL|INSURANCE|BANK|MART|STORE|SHOP|SERVICES|PG)\b|\.COM|\d/i;
  var SUBSCRIPTION = /\b(ANTHROPIC|CLAUDE\.AI|OPENAI|CHATGPT|NETFLIX|SPOTIFY|DISNEY|YOUTUBE ?PREMIUM|APPLE\.COM|ICLOUD|GOOGLE ?(ONE|STORAGE)|NOTION|CANVA|ADOBE|MICROSOFT|GITHUB|DROPBOX|PATREON|AMAZON ?PRIME)\b/i;
  var KEYWORD_RULES = [
    [/\b(BBT|BUBBLE ?TEA|KOI|LIHO|CHICHA|GONG ?CHA|DRINKS?|SNACKS?|KOPI|COFFEE|CAFE|STARBUCKS|TOAST|MCDONALD|KFC|BURGER|PIZZA|SUBWAY|FOOD|RESTAURANT|EATERY|KITCHEN|NOODLES?|MIAN|BAK ?KUT|HAWKER|KOUFU|KOPITIAM|FOOD ?REPUBLIC|FOMO ?PAY|DELIVEROO|FOODPANDA)\b/i, "Food & Drinks"],
    [/\b(NTUC|FAIRPRICE|SHENG ?SIONG|COLD ?STORAGE|GIANT|DON ?DON ?DONKI|PRIME ?SUPERMARKET)\b/i, "Groceries"],
    [/\b(GRAB|GOJEK|COMFORT ?DELGRO|CDG|TADA|RYDE|SIMPLYGO|BUS\/MRT|TRANSITLINK|EZ-?LINK|SMRT|SBS ?TRANSIT|SHELL|ESSO|CALTEX|SPC)\b/i, "Transport"],
    [/\b(TRIP\.?COM|AGODA|BOOKING\.?COM|EXPEDIA|AIRBNB|KLOOK|AIRASIA|SCOOT|SINGAPORE AIRLINES|JETSTAR|HOTEL)\b/i, "Travel"],
    [/\b(SHOPEE|LAZADA|AMAZON|TAOBAO|QOO10|UNIQLO|IKEA|DAISO|WATSONS|GUARDIAN|POPULAR)\b/i, "Shopping"],
    [/\b(SINGTEL|STARHUB|M1|CIRCLES|GIGA|SP ?GROUP|SP ?SERVICES|TOWN ?COUNCIL|INSURANCE|PRUDENTIAL|AIA|GREAT EASTERN|INCOME)\b/i, "Bills & Utilities"],
    [SUBSCRIPTION, "Subscriptions"],
    [/\b(YOUTUBE|GOOGLE ?PLAY|STEAM|GV|SHAW|CATHAY|GOLDEN ?VILLAGE)\b/i, "Entertainment"],
    [/\bATM\b/i, "Cash"],
    [/\b(CLINIC|POLYCLINIC|HOSPITAL|PHARMACY|DENTAL|MEDICAL)\b/i, "Health"]
  ];
  function normaliseMerchant(merchant) {
    return merchant.toUpperCase().replace(/\b(PTE\.?|LTD\.?|LIMITED|PRIVATE|SINGAPORE|SG)\b/g, " ").replace(/[^A-Z0-9&.' ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var OWN_TRANSFER = /TOP-?UP TO PAYLAH|MAXED OUT FROM PAYLAH|PayLah! top-up/i;
  function isOwnName(merchant, ownNames) {
    const key = normaliseMerchant(merchant);
    return ownNames.some((n) => n.trim() && ` ${key} `.includes(` ${normaliseMerchant(n)} `));
  }
  function moneyIn(txn, allowanceNames) {
    var _a;
    const hay = `${txn.merchant} ${(_a = txn.description) != null ? _a : ""}`;
    if (isOwnName(txn.merchant, allowanceNames)) return "Allowance";
    if (/INTEREST|REBATE|BOOSTER|CASHBACK/i.test(hay)) return "Interest & rebates";
    if (/REVERS|REFUND|RETURNED/i.test(hay)) return "Refunds";
    if (/\b(GOV|MINDEF|SAF|SALARY|PAYROLL|IRAS|CPF)\b/i.test(hay)) return "Income";
    if (txn.payeeType === "business" || BUSINESS.test(txn.merchant)) return "Refunds";
    if (txn.payeeType === "person" || /^[A-Za-z ,.'-]+$/.test(txn.merchant.trim())) return "Paid back";
    return "Income";
  }
  function categorise(txn, userRules = [], ownNames = [], allowanceNames = []) {
    var _a, _b;
    const key = normaliseMerchant(txn.merchant);
    const userHit = userRules.find((r) => r.merchantKey === key);
    if (userHit) return userHit.category;
    const hay = `${txn.merchant} ${(_a = txn.description) != null ? _a : ""}`;
    if (OWN_TRANSFER.test(hay)) return "Own transfers";
    if (isOwnName(txn.merchant, ownNames)) return "Own transfers";
    if (txn.direction === "credit") return moneyIn(txn, allowanceNames);
    if (/\b(ang ?bao|hong ?bao|gift|birthday|wedding)\b/i.test((_b = txn.description) != null ? _b : "") && txn.kind !== "card") return "Gifts";
    for (const [re, cat] of KEYWORD_RULES) if (re.test(hay)) return cat;
    if (txn.payeeType === "person") return "Transfers";
    return "Uncategorised";
  }
  function dedupKey(txn) {
    if (txn.reference) return `${txn.source}:ref:${txn.reference}`;
    return `${txn.source}:${txn.occurredAt.slice(0, 16)}:${txn.amountCents}:${normaliseMerchant(txn.merchant)}`;
  }

  // src/lib/ai.ts
  var GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
  var geminiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  var AI_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c !== "Own transfers" && !MONEY_IN.includes(c));
  function geminiRequest(payees) {
    const prompt = [
      "Categorise these payees from a Singapore bank account. Each one is money going out.",
      "Pick the single best category for each. Anything you can't tell is Uncategorised.",
      "A PayLah! Scan & Pay or NETS QR payment to a person's name is usually a hawker stall or small shop: small amounts there are usually Food & Drinks.",
      "A PayNow transfer to a person's name is Transfers.",
      `Categories: ${AI_CATEGORIES.join(", ")}.`,
      "",
      ...payees.map((p) => JSON.stringify(p))
    ].join("\n");
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { id: { type: "INTEGER" }, category: { type: "STRING", enum: AI_CATEGORIES } },
            required: ["id", "category"]
          }
        }
      }
    };
  }
  function parseGeminiReply(body) {
    var _a, _b, _c, _d, _e, _f;
    const out = /* @__PURE__ */ new Map();
    const text = (_f = (_e = (_d = (_c = (_b = (_a = JSON.parse(body)) == null ? void 0 : _a.candidates) == null ? void 0 : _b[0]) == null ? void 0 : _c.content) == null ? void 0 : _d.parts) == null ? void 0 : _e[0]) == null ? void 0 : _f.text;
    if (!text) return out;
    const allowed = new Set(AI_CATEGORIES);
    for (const r of JSON.parse(text)) if (Number.isInteger(r == null ? void 0 : r.id) && allowed.has(r == null ? void 0 : r.category)) out.set(r.id, r.category);
    return out;
  }

  // src/lib/match.ts
  var DAY = 864e5;
  var sgtDay = (ms) => Math.floor((ms + 8 * 36e5) / DAY);
  var words = (key) => new Set(key.split(" ").filter((w) => w.length >= 3));
  var BANK_WORDS = /* @__PURE__ */ new Set(["FAST", "PAYMENT", "RECEIPT", "TRANSFER", "FUNDS", "FUND", "ADVICE", "PAYNOW", "GIRO", "INWARD", "INCOMING", "CREDIT", "IBG", "MEPS"]);
  var isGeneric = (key) => key.split(" ").every((w) => !w || BANK_WORDS.has(w));
  function findMatch(t, candidates2, used) {
    const pool = candidates2.filter(
      (c) => !used.has(c.id) && c.direction === t.direction && c.amountCents === t.amountCents && Math.abs(sgtDay(c.at) - sgtDay(t.at)) <= 3
    );
    const mine = words(t.merchantKey);
    const named = pool.filter((c) => [...words(c.merchantKey)].some((w) => mine.has(w)));
    const best = named.sort((a, b) => Math.abs(a.at - t.at) - Math.abs(b.at - t.at))[0];
    if (best) return best;
    const blind = pool.filter(
      (c) => (isGeneric(c.merchantKey) || isGeneric(t.merchantKey)) && c.account && c.account === t.account && Math.abs(sgtDay(c.at) - sgtDay(t.at)) <= 1
    );
    return blind.length === 1 ? blind[0] : null;
  }

  // src/lib/recurring.ts
  var DAY2 = 864e5;
  var SUBSCRIPTION_LIKE = /* @__PURE__ */ new Set(["Subscriptions", "Bills & Utilities", "Entertainment"]);
  var HABITS = /* @__PURE__ */ new Set(["Food & Drinks", "Groceries"]);
  var MIN_AMOUNT = 3;
  var median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  function groupKey(merchantKey) {
    return merchantKey.replace(/\b\d[\d ]*\b/g, " ").replace(/\s+/g, " ").trim().slice(0, 12).trim();
  }
  function describeEvery(days) {
    if (days >= 6 && days <= 8) return "week";
    if (days >= 13 && days <= 16) return "2 weeks";
    if (days >= 26 && days <= 35) return "month";
    if (days >= 85 && days <= 95) return "3 months";
    if (days >= 350 && days <= 380) return "year";
    return days < 26 ? `~${Math.round(days / 7)} weeks` : `~${Math.round(days / 30.4)} months`;
  }
  function findRecurring(spends, now, coveredUntil) {
    var _a, _b;
    const groups = /* @__PURE__ */ new Map();
    for (const s of spends) {
      const k = groupKey(s.merchantKey);
      if (!k) continue;
      groups.set(k, [...(_a = groups.get(k)) != null ? _a : [], s]);
    }
    const out = [];
    for (const all of groups.values()) {
      const usual = median(all.map((s) => s.amount));
      const series = all.filter((s) => Math.abs(s.amount - usual) <= usual * 0.1).sort((a, b) => a.at - b.at);
      const latest = (_b = series[series.length - 1]) != null ? _b : all[all.length - 1];
      const days = [...new Set(series.map((s) => Math.floor(s.at / DAY2)))];
      const subscription = latest.category === "Subscriptions";
      if (days.length < 3) {
        if (subscription && now - latest.at < 90 * DAY2) out.push(entry(series.length ? series : all, null, true, now, coveredUntil));
        continue;
      }
      if (!subscription && (HABITS.has(latest.category) || usual < MIN_AMOUNT)) continue;
      const gaps = days.slice(1).map((d, i) => d - days[i]);
      const gap = median(gaps);
      const steady = gaps.filter((g) => Math.abs(g - gap) <= gap * 0.4).length / gaps.length;
      if (gap < 14 || steady < 0.6) continue;
      if (now - latest.at > Math.max(90, gap * 3) * DAY2) continue;
      out.push(entry(series, gap, subscription, now, coveredUntil));
    }
    return out.sort((a, b) => b.perMonth - a.perMonth);
  }
  function entry(series, gap, subscription, now, coveredUntil) {
    const latest = series[series.length - 1];
    const amount = median(series.map((s) => s.amount));
    const fixed = series.every((s) => Math.abs(s.amount - amount) < 0.01);
    const next = gap ? latest.at + gap * DAY2 : null;
    return {
      merchant: latest.merchant,
      category: latest.category,
      amount,
      everyDays: gap != null ? gap : 0,
      every: gap ? describeEvery(gap) : "seen once",
      times: series.length,
      first: series[0].at,
      last: latest.at,
      nextExpected: next,
      perMonth: gap ? amount * 30.4 / gap : subscription ? amount : 0,
      kind: subscription || fixed && gap !== null && gap >= 26 && SUBSCRIPTION_LIKE.has(latest.category) ? "Subscription" : "Regular payment",
      // A week's grace, or a third of the interval for longer ones
      overdue: next !== null && gap !== null && next + Math.max(7, gap / 3) * DAY2 < Math.min(now, coveredUntil)
    };
  }

  // src/lib/parsers/util.ts
  var MONTHS = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12
  };
  function normaliseText(text) {
    return text.replace(/\r\n?/g, "\n").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/\t/g, " ").replace(/&zwnj;|\u200c/g, "").replace(/&[lr]dquo;/g, '"').replace(/&[lr]squo;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/^>+ ?/gm, "");
  }
  function htmlToText(html) {
    return html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<\/t[dh]>/gi, "	").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, "\n\n");
  }
  function extractFields(text) {
    const fields = {};
    let pending = null;
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const m = line.match(/^\s*([A-Za-z][A-Za-z &]{1,40}?)\s*:\s*(.*?)\s*$/);
      const value = m ? m[2] : pending ? line.trim() : "";
      const label = m ? m[1].toLowerCase() : pending;
      pending = m && !m[2] ? m[1].toLowerCase() : null;
      if (label && value && !(label in fields)) fields[label] = value;
    }
    return fields;
  }
  function parseAmount(raw) {
    const m = raw.match(/([A-Z]{3})\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!m) return null;
    return { currency: m[1], amountCents: Math.round(parseFloat(m[2].replace(/,/g, "")) * 100) };
  }
  function monthIndex(name) {
    var _a;
    return (_a = MONTHS[name.toLowerCase()]) != null ? _a : null;
  }
  function parseTime(raw) {
    var _a;
    const t = raw.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
    if (!t) return null;
    let h = parseInt(t[1], 10);
    const m = parseInt(t[2], 10);
    const ampm = (_a = t[3]) == null ? void 0 : _a.toUpperCase();
    if (h <= 12 && ampm === "PM" && h !== 12) h += 12;
    if (h === 12 && ampm === "AM") h = 0;
    return { h, m };
  }
  var pad = (n) => String(n).padStart(2, "0");
  function toSgtIso(y, mo, d, h = 0, mi = 0) {
    return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+08:00`;
  }
  function sgtYear(date) {
    return new Date(date.getTime() + 8 * 36e5).getUTCFullYear();
  }
  function inferYear(mo, d, receivedAt) {
    const y = sgtYear(receivedAt);
    const candidate = Date.UTC(y, mo - 1, d) - 8 * 36e5;
    return candidate > receivedAt.getTime() + 2 * 864e5 ? y - 1 : y;
  }
  function expandYear(y) {
    const n = parseInt(y, 10);
    return y.length === 2 ? 2e3 + n : n;
  }

  // src/lib/parsers/dbs.ts
  function parsePayLah(email, text) {
    var _a, _b, _c, _d;
    if (!/PayLah!/i.test(text)) return null;
    const f = extractFields(text);
    const dt = ((_a = f["date & time"]) != null ? _a : "").match(/(\d{1,2})\s+([A-Za-z]{3,4})(?:\s+(\d{4}))?\s+(\d{1,2}:\d{2})/);
    const amount = f.amount && parseAmount(f.amount);
    if (!dt || !amount || !f.to) return { status: "unrecognised" };
    const mo = monthIndex(dt[2]);
    if (!mo) return { status: "unrecognised" };
    const d = parseInt(dt[1], 10);
    const y = dt[3] ? parseInt(dt[3], 10) : inferYear(mo, d, email.receivedAt);
    const t = parseTime(dt[4]);
    const kindMatch = text.match(/your PayLah! (.+?) dated/i);
    const toPhone = /\(Mobile ending \d+\)\s*$/i.test(f.to);
    return {
      status: "parsed",
      txn: {
        source: "dbs_paylah",
        kind: "ewallet",
        direction: "debit",
        ...amount,
        occurredAt: toSgtIso(y, mo, d, t.h, t.m),
        merchant: f.to.replace(/\s*\(Mobile ending \d+\)\s*$/i, "").trim(),
        account: "PayLah! Wallet",
        reference: (_b = f["transaction ref"]) != null ? _b : null,
        description: (_c = kindMatch == null ? void 0 : kindMatch[1].trim()) != null ? _c : null,
        payeeType: /Scan & Pay/i.test((_d = kindMatch == null ? void 0 : kindMatch[1]) != null ? _d : "") ? "business" : toPhone ? "person" : "unknown"
      }
    };
  }
  function parseReceived(text) {
    var _a, _b, _c;
    const m = text.match(/You have received ([A-Z]{3}\s*[\d,]+\.\d{2}) via (.+?) on (\d{1,2}) ([A-Za-z]{3,4}) (\d{4}) (\d{1,2}:\d{2})/i);
    if (!m) return null;
    const f = extractFields(text);
    const amount = parseAmount(m[1]);
    const mo = monthIndex(m[4]);
    const acct = ((_a = f.to) != null ? _a : "").match(/ending (\d{4})/i);
    if (!amount || !mo || !acct) return { status: "unrecognised" };
    const t = parseTime(m[6]);
    return {
      status: "parsed",
      txn: {
        source: "dbs",
        kind: /PayNow/i.test(m[2]) ? "paynow" : "transfer",
        direction: "credit",
        ...amount,
        occurredAt: toSgtIso(parseInt(m[5], 10), mo, parseInt(m[3], 10), t.h, t.m),
        merchant: ((_b = f.from) != null ? _b : "Unknown sender").trim(),
        // Same label as the statement parser, so the balance estimate counts it
        account: `DBS/POSB (-${acct[1]})`,
        reference: (_c = f["transaction ref"]) != null ? _c : null,
        description: `Received via ${m[2].trim()}`,
        payeeType: "unknown"
      }
    };
  }
  function parseDbs(email, text) {
    var _a, _b;
    if (!/DBS|POSB/i.test(text) && !/dbs\.com/i.test((_a = email.from) != null ? _a : "")) return null;
    return (_b = parsePayLah(email, text)) != null ? _b : parseReceived(text);
  }

  // src/lib/parsers/ocbc.ts
  function parseOcbcDate(dateRaw, timeRaw) {
    var _a, _b;
    const d = dateRaw.match(/(\d{1,2})[\s-]([A-Za-z]{3,4})[\s-](\d{2,4})/);
    if (!d) return null;
    const mo = monthIndex(d[2]);
    if (!mo) return null;
    const t = timeRaw ? parseTime(timeRaw) : null;
    return toSgtIso(expandYear(d[3]), mo, parseInt(d[1], 10), (_a = t == null ? void 0 : t.h) != null ? _a : 0, (_b = t == null ? void 0 : t.m) != null ? _b : 0);
  }
  function parsePayNowOrTransfer(text) {
    var _a, _b, _c, _d, _e, _f;
    if (/following PayNow transfer could not be made/i.test(text)) return { status: "ignored", reason: "failed_transfer" };
    const header = (_a = text.match(/following PayNow transfer has been made to (.+?) using (?:their|his\/her) (Unique Entity Number|mobile(?: number)?|NRIC|VPA)/is)) != null ? _a : text.match(/following (.+?) has been sent via the OCBC app/i);
    if (!header) return null;
    const f = extractFields(text);
    const amount = f.amount && parseAmount(f.amount);
    const occurredAt = f.date && parseOcbcDate(f.date, f.time);
    if (!amount || !occurredAt) return { status: "unrecognised" };
    const isPayNow = /PayNow transfer/i.test(header[0]);
    let merchant;
    let payeeType;
    if (isPayNow) {
      merchant = header[1].replace(/\s+/g, " ").trim();
      payeeType = /Entity/i.test(header[2]) ? "business" : "person";
    } else {
      merchant = ((_b = f.to) != null ? _b : "").replace(/\s+using .*$/i, "").trim() || header[1].trim();
      payeeType = /mobile|NRIC/i.test((_c = f.to) != null ? _c : "") ? "person" : "unknown";
    }
    return {
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: isPayNow ? "paynow" : "transfer",
        direction: "debit",
        ...amount,
        occurredAt,
        merchant,
        account: (_d = f["from your account"]) != null ? _d : "OCBC",
        reference: (_e = f["reference number"]) != null ? _e : null,
        description: isPayNow ? (_f = f.description) != null ? _f : null : header[1].trim(),
        payeeType
      }
    };
  }
  function parseFundsTransfer(text) {
    var _a, _b, _c, _d, _e;
    if (!/request to make the following transfer/i.test(text)) return null;
    const f = extractFields(text);
    const amount = f.amount && parseAmount(f.amount);
    const occurredAt = f["date of transfer"] && parseOcbcDate(f["date of transfer"], f["time of transfer"]);
    const to = ((_a = f["to account"]) != null ? _a : "").match(/^(.+?)\s*\((-?\w+)\)(?:\s+at\s+(.+))?$/);
    if (!amount || !occurredAt || !to) return { status: "unrecognised" };
    return {
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: "transfer",
        direction: "debit",
        ...amount,
        occurredAt,
        merchant: to[1].trim(),
        account: (_b = f["from your account"]) != null ? _b : "OCBC",
        reference: (_c = f["reference number"]) != null ? _c : null,
        description: `Transfer to ${(_e = (_d = to[3]) == null ? void 0 : _d.trim()) != null ? _e : "account"} (${to[2]})`,
        payeeType: "person"
      }
    };
  }
  function parseNetsQr(text) {
    var _a, _b;
    if (!/following NETS QR payment has been made/i.test(text)) return null;
    const f = extractFields(text);
    const amount = f.amount && parseAmount(f.amount);
    const occurredAt = f.date && parseOcbcDate(f.date, f.time);
    if (!amount || !occurredAt || !f.to) return { status: "unrecognised" };
    const account = (_a = f["from your account"]) != null ? _a : "OCBC";
    return {
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: "nets",
        direction: "debit",
        ...amount,
        occurredAt,
        merchant: f.to.replace(/\s+/g, " ").trim(),
        account: /^OCBC/i.test(account) ? account : `OCBC ${account}`,
        reference: (_b = f["reference number"]) != null ? _b : null,
        description: "NETS QR",
        payeeType: "business"
      }
    };
  }
  function parseAtm(text) {
    const m = text.match(
      /([A-Z]{3}\s*[\d,]+\.\d{2}) was withdrawn from your (.+?\(-?\d+\)) .*?at an? (.+?ATM)\. This was done at (\d{1,2}[:.]\d{2}(?:\s*[AP]M)?) on (\d{1,2} [A-Za-z]{3,4} \d{4})/is
    );
    if (!m) return null;
    const amount = parseAmount(m[1]);
    const occurredAt = parseOcbcDate(m[5], m[4]);
    if (!amount || !occurredAt) return { status: "unrecognised" };
    return {
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: "atm",
        direction: "debit",
        ...amount,
        occurredAt,
        merchant: m[3].trim(),
        account: m[2].trim(),
        reference: null,
        description: "ATM withdrawal",
        payeeType: "unknown"
      }
    };
  }
  function parseCard(text) {
    const m = text.match(
      /([A-Z]{3}\s*[\d,]+(?:\.\d{1,2})?) was charged at (\d{1,2}:\d{2}(?:\s*[AP]M)?) on (\d{1,2}-[A-Za-z]{3}-\d{2,4}) to your card \((-?\d{4})\) at (.+?)\.\s*$/im
    );
    if (!m) return null;
    const amount = parseAmount(m[1]);
    const occurredAt = parseOcbcDate(m[3], m[2]);
    if (!amount || !occurredAt) return { status: "unrecognised" };
    return {
      status: "parsed",
      txn: {
        source: "ocbc",
        kind: "card",
        direction: "debit",
        ...amount,
        occurredAt,
        merchant: m[5].trim(),
        account: `OCBC Card (${m[4]})`,
        reference: null,
        description: null,
        payeeType: "business"
      }
    };
  }
  function parseOcbc(email, text) {
    var _a, _b, _c, _d, _e;
    if (!/OCBC/i.test(text) && !/ocbc\.com/i.test((_a = email.from) != null ? _a : "")) return null;
    if (/monthly e-Statement/i.test(text)) return { status: "ignored", reason: "statement_notice" };
    return (_e = (_d = (_c = (_b = parsePayNowOrTransfer(text)) != null ? _b : parseFundsTransfer(text)) != null ? _c : parseNetsQr(text)) != null ? _d : parseAtm(text)) != null ? _e : parseCard(text);
  }

  // src/lib/parsers/index.ts
  var PARSERS = [parseOcbc, parseDbs];
  function parseEmail(email) {
    const text = normaliseText(email.text);
    for (const parser of PARSERS) {
      const result = parser(email, text);
      if (result) return result;
    }
    return { status: "unrecognised" };
  }

  // src/lib/statements/util.ts
  var AMOUNT = /[\d,]+\.\d{2}/g;
  function cents(raw) {
    return Math.round(parseFloat(raw.replace(/,/g, "")) * 100);
  }
  var indentOf = (line) => line.length - line.trimStart().length;
  function splitAmounts(rest) {
    const m = rest.match(/^(.*?)((?:\s+[\d,]+\.\d{2})+)\s*$/);
    if (!m) return null;
    const amounts = [];
    const base = m[1].length;
    for (const a of m[2].matchAll(AMOUNT)) amounts.push({ cents: cents(a[0]), at: base + a.index });
    return { text: m[1].trim(), amounts };
  }
  function direction(amount, balance, prev, at, cols) {
    if (balance !== null && prev !== null) {
      if (prev - amount === balance) return "debit";
      if (prev + amount === balance) return "credit";
    }
    if (cols) return Math.abs(at - cols.out) <= Math.abs(at - cols.in) ? "debit" : "credit";
    return "debit";
  }
  function informative(line) {
    return /[A-Za-z]{2,}/.test(line) && !/^(OTHR|OTHER|via |NETS QR PURCHASE|\d{2}\/\d{2}\/\d{2,4}$)/i.test(line) && !/^[A-Z0-9-]*\d{6,}[A-Z0-9-]*$/.test(line);
  }
  function check(account, opening, closing, asOf, txns) {
    let debitCents = 0;
    let creditCents = 0;
    for (const t of txns) {
      if (t.account !== account) continue;
      if (t.direction === "debit") debitCents += t.amountCents;
      else creditCents += t.amountCents;
    }
    return { account, openingCents: opening, closingCents: closing, asOf, debitCents, creditCents, balanced: opening - debitCents + creditCents === closing };
  }

  // src/lib/statements/dbs.ts
  function describe(type, lines) {
    const all = `${type} ${lines.join(" ")}`;
    if (/TOP-?UP TO PAYLAH/i.test(all)) return { merchant: "PayLah! top-up", kind: "transfer", payeeType: "unknown" };
    const after = lines.findIndex((l) => /PAYLAH! :$/i.test(l));
    const named = after >= 0 ? lines.slice(after + 1).find(informative) : lines.find(informative);
    return {
      merchant: named != null ? named : type.replace(/^Advice\s+/i, ""),
      kind: /PayNow|FAST|Transfer/i.test(all) ? "transfer" : "other",
      payeeType: "unknown"
    };
  }
  function parseDbsStatement(lines) {
    if (!lines.some((l) => /DBS|POSB/.test(l)) || !lines.some((l) => /Transaction Details/i.test(l))) return null;
    const end = lines.map((l) => l.match(/as at (\d{1,2}) ([A-Za-z]{3}) (\d{4})/i)).find(Boolean);
    const endMonth = end && monthIndex(end[2]);
    const asOf = end && endMonth ? toSgtIso(+end[3], endMonth, +end[1]).slice(0, 10) : "";
    const header = lines.find((l) => /Withdrawal/.test(l) && /Deposit/.test(l));
    const cols = header ? { out: header.indexOf("Withdrawal"), in: header.indexOf("Deposit") } : null;
    const txns = [];
    const accounts = [];
    let account = "";
    let number = "";
    let opening = null;
    let balance = null;
    let open = null;
    const close = () => {
      var _a;
      if (!open) return;
      const o = open;
      open = null;
      const d = describe(o.type, o.lines);
      const iso = toSgtIso(o.date.y, o.date.m, o.date.d);
      txns.push({
        source: "dbs",
        kind: d.kind,
        direction: o.dir,
        amountCents: o.amount,
        currency: "SGD",
        occurredAt: iso,
        merchant: d.merchant,
        account,
        reference: null,
        description: [o.type, ...o.lines].join(" / "),
        payeeType: d.payeeType,
        stmtKey: `dbs:stmt:${number}:${iso.slice(0, 10)}:${o.amount}:${(_a = o.balance) != null ? _a : txns.length}`
      });
    };
    const finish = () => {
      var _a;
      close();
      if (account && opening !== null) accounts.push(check(account, opening, balance != null ? balance : opening, asOf || ((_a = txns[txns.length - 1]) == null ? void 0 : _a.occurredAt.slice(0, 10)) || "", txns));
      opening = null;
    };
    let inDetails = false;
    for (const line of lines) {
      if (/Transaction Details/i.test(line)) inDetails = true;
      if (!inDetails) continue;
      const acct = line.match(/Account No\.?\s*([\d-]{6,})/);
      if (acct) {
        if (acct[1] !== number) {
          finish();
          number = acct[1];
          account = `DBS/POSB (-${number.replace(/\D/g, "").slice(-4)})`;
        }
        continue;
      }
      const bf = line.match(/Balance Brought Forward\s+(?:SGD\s+)?([\d,]+\.\d{2})/i);
      if (bf) {
        close();
        balance = cents(bf[1]);
        opening != null ? opening : opening = balance;
        continue;
      }
      if (/Balance Carried Forward/i.test(line)) {
        close();
        continue;
      }
      const t = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s+(.*)$/);
      const split = t && splitAmounts(t[4]);
      if (t && split) {
        close();
        if (!split.text) continue;
        const amount = split.amounts[0];
        const bal = split.amounts.length > 1 ? split.amounts[split.amounts.length - 1].cents : null;
        const at = line.length - t[4].length + amount.at;
        open = {
          date: { d: +t[1], m: +t[2], y: +t[3] },
          type: split.text,
          indent: line.length - t[4].length,
          amount: amount.cents,
          balance: bal,
          dir: direction(amount.cents, bal, balance, at, cols),
          lines: []
        };
        balance = bal != null ? bal : balance === null ? null : open.dir === "debit" ? balance - amount.cents : balance + amount.cents;
        continue;
      }
      const text = line.trim();
      if (open && text && Math.abs(indentOf(line) - open.indent) <= 3 && !/^\d{1,4}$/.test(text)) open.lines.push(text);
    }
    finish();
    if (!accounts.length) return null;
    return { bank: "DBS", txns, accounts };
  }

  // src/lib/statements/ocbc.ts
  function describe2(type, lines) {
    var _a;
    const card = lines.map((l) => l.match(/^xx-(\d{4})\s+(.+)$/)).find(Boolean);
    const bought = lines.map((l) => l.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)).find(Boolean);
    const to = lines.map((l) => l.match(/^(?:to|from)\s+(.+)$/i)).find(Boolean);
    const all = lines.join(" ");
    if (card)
      return {
        merchant: card[2].trim(),
        kind: "card",
        payeeType: "business",
        card: card[1],
        bought: bought ? { d: +bought[1], m: +bought[2], y: 2e3 + +bought[3] } : null
      };
    if (/NETS QR/i.test(type))
      return { merchant: (_a = lines.filter(informative).pop()) != null ? _a : type, kind: "nets", payeeType: "business" };
    if (to)
      return {
        merchant: to[1].trim(),
        kind: /PayNow/i.test(all) ? "paynow" : "transfer",
        payeeType: /PayNow-UEN/i.test(all) ? "business" : /PayNow-(Mobile|NRIC)/i.test(all) ? "person" : "unknown"
      };
    const named = /FEE|CHARGE|REBATE/i.test(type) ? void 0 : lines.find(informative);
    return { merchant: named != null ? named : type, kind: "other", payeeType: "unknown" };
  }
  function lineYear(mon, endMonth, endYear) {
    if (endMonth === 12 && mon === 1) return endYear + 1;
    if (endMonth === 1 && mon === 12) return endYear - 1;
    return mon > endMonth + 1 ? endYear - 1 : endYear;
  }
  function parseOcbcStatement(lines) {
    var _a, _b, _c, _d;
    if (!lines.some((l) => /STATEMENT OF ACCOUNT/i.test(l)) || !lines.some((l) => /OCBC/.test(l))) return null;
    const period = lines.map((l) => l.match(/(\d{1,2}) ([A-Z]{3}) (\d{4}) TO (\d{1,2}) ([A-Z]{3}) (\d{4})/)).find(Boolean);
    if (!period) return null;
    const endMonth = monthIndex(period[5]);
    const endYear = +period[6];
    const name = (_b = (_a = lines.map((l) => l.trim().match(/^(OCBC [A-Z0-9 ]*?ACCOUNT)\b/)).find(Boolean)) == null ? void 0 : _a[1]) != null ? _b : "OCBC ACCOUNT";
    const number = (_d = (_c = lines.map((l) => l.match(/Account No\.?\s*(\d{6,})/)).find(Boolean)) == null ? void 0 : _c[1]) != null ? _d : "";
    const account = `${name.replace(/ACCOUNT$/, "Account")} (-${number.slice(-6)})`;
    const header = lines.find((l) => /Withdrawal/.test(l) && /Deposit/.test(l));
    const cols = header ? { out: header.indexOf("Withdrawal"), in: header.indexOf("Deposit") } : null;
    const txns = [];
    let opening = null;
    let balance = null;
    let open = null;
    const close = () => {
      var _a2;
      if (!open) return;
      const o = open;
      open = null;
      const d = describe2(o.type, o.lines);
      const year = lineYear(o.mon, endMonth, endYear);
      const when = "bought" in d && d.bought ? d.bought : { d: o.day, m: o.mon, y: year };
      const posted = toSgtIso(year, o.mon, o.day).slice(0, 10);
      txns.push({
        source: "ocbc",
        kind: d.kind,
        direction: o.dir,
        amountCents: o.amount,
        currency: "SGD",
        occurredAt: toSgtIso(when.y, when.m, when.d),
        merchant: d.merchant,
        account,
        reference: null,
        description: [o.type, ...o.lines].join(" / "),
        payeeType: d.payeeType,
        stmtKey: `ocbc:stmt:${number}:${posted}:${o.amount}:${(_a2 = o.balance) != null ? _a2 : txns.length}`
      });
    };
    for (const line of lines) {
      const bf = line.match(/BALANCE B\/F\s+([\d,]+\.\d{2})/);
      if (bf) {
        close();
        balance = cents(bf[1]);
        opening != null ? opening : opening = balance;
        continue;
      }
      if (/BALANCE C\/F/.test(line)) {
        close();
        continue;
      }
      const t = line.match(/^\s*(\d{2}) ([A-Z]{3})\s+\d{2} [A-Z]{3}\s+(.*)$/);
      const mon = t && monthIndex(t[2]);
      const split = t && splitAmounts(t[3]);
      if (t && mon && split && split.amounts.length) {
        close();
        const amount = split.amounts[0];
        const bal = split.amounts.length > 1 ? split.amounts[split.amounts.length - 1].cents : null;
        const at = line.length - t[3].length + amount.at;
        open = {
          day: +t[1],
          mon,
          type: split.text,
          indent: line.length - t[3].length,
          amount: amount.cents,
          balance: bal,
          dir: direction(amount.cents, bal, balance, at, cols),
          lines: []
        };
        balance = bal != null ? bal : balance === null ? null : open.dir === "debit" ? balance - amount.cents : balance + amount.cents;
        continue;
      }
      const text = line.trim();
      if (open && text && Math.abs(indentOf(line) - open.indent) <= 3 && !/^\d{1,4}$/.test(text)) open.lines.push(text);
    }
    close();
    if (opening === null) return null;
    const asOf = toSgtIso(endYear, endMonth, +period[4]).slice(0, 10);
    return { bank: "OCBC", txns, accounts: [check(account, opening, balance != null ? balance : opening, asOf, txns)] };
  }

  // src/lib/statements/index.ts
  function parseStatement(lines) {
    var _a;
    return (_a = parseOcbcStatement(lines)) != null ? _a : parseDbsStatement(lines);
  }

  // src/gas/main.ts
  var TX = "Transactions";
  var SUMMARY = "Dashboard";
  var OLD_SUMMARY = "Summary";
  var REVIEW = "Review";
  var RULES = "Rules";
  var SETTINGS = "Settings";
  var UNRECOGNISED = "Unrecognised";
  var ACCOUNTS = "Accounts";
  var TRENDS = "Trends";
  var RECURRING = "Recurring";
  var HEADERS = [
    "Date",
    "Merchant",
    "Amount",
    "Currency",
    "Direction",
    "Category",
    "Account",
    "Type",
    "Description",
    "Source",
    "Reference",
    "Merchant key",
    "Key",
    "Statement key",
    "Note"
  ];
  var C = Object.fromEntries(HEADERS.map((h, i) => [h, i]));
  var QUERY = '(from:ocbc.com OR from:dbs.com OR "We refer to your PayLah!")';
  var BACKFILL_DAYS = 365;
  var PARSER_VERSION = 4;
  var DAY3 = 864e5;
  var TIME_BUDGET = 3 * 6e4;
  var MONEY = /\b(?:SGD|USD|S\$)\s?[\d,]+\.\d{2}\b/;
  var book = () => SpreadsheetApp.getActiveSpreadsheet();
  function ensureSheet(name, headers) {
    let s = book().getSheetByName(name);
    if (!s) {
      s = book().insertSheet(name);
      s.getRange(1, 1, 1, headers.length).setValues([[...headers]]).setFontWeight("bold");
      s.setFrozenRows(1);
    }
    return s;
  }
  function ensureSheets() {
    const fresh = !book().getSheetByName(TX);
    const tx = ensureSheet(TX, HEADERS);
    if (fresh) {
      tx.getRange("A2:A").setNumberFormat("yyyy-mm-dd hh:mm");
      tx.getRange("C2:C").setNumberFormat("#,##0.00");
      categoryDropdown(tx);
      resetColours(tx);
      tx.hideColumns(C["Merchant key"] + 1, 3);
      tx.setColumnWidth(C.Merchant + 1, 220);
      tx.setColumnWidth(C.Description + 1, 280);
    }
    const rules = ensureSheet(RULES, ["Merchant key", "Category", "Set by"]);
    if (!rules.getRange(1, 3).getValue()) rules.getRange(1, 3).setValue("Set by").setFontWeight("bold");
    ensureSheet(UNRECOGNISED, ["Received", "From", "Subject", "Message ID", "Text"]);
    if (!book().getSheetByName(ACCOUNTS)) {
      const a = ensureSheet(ACCOUNTS, [...ACCOUNT_HEADERS]);
      a.getRange("B2:B").setNumberFormat("#,##0.00");
      a.getRange("D2:D").setNumberFormat("#,##0.00");
      a.setColumnWidth(1, 240);
    }
    if (!book().getSheetByName(SETTINGS)) {
      ensureSheet(SETTINGS, ["Setting", "Value"]).getRange(2, 1, 1, 2).setValues([["Your names on statements (comma-separated), so transfers to yourself aren't counted as spending", ""]]);
    }
    const settings = book().getSheetByName(SETTINGS);
    if (!settings.getRange(4, 1).getValue()) settings.getRange(4, 1).setValue(PAYLAH_SETTING);
    if (!settings.getRange(6, 1).getValue())
      settings.getRange(6, 1, 2, 1).setValues([
        ["Start date (yyyy-mm-dd): payments before this are removed and not added again. Blank keeps everything"],
        ["People who give you an allowance (comma-separated), so it isn't counted as being paid back"]
      ]);
    upgradeLayout(tx);
  }
  var LAYOUT_VERSION = 11;
  var TAB_ORDER = [SUMMARY, TRENDS, TX, RECURRING, REVIEW, ACCOUNTS, RULES, SETTINGS, UNRECOGNISED];
  function upgradeLayout(tx) {
    const props = PropertiesService.getScriptProperties();
    const current = Number(props.getProperty("layout")) || 0;
    if (current >= LAYOUT_VERSION && book().getSheetByName(SUMMARY) && book().getSheetByName(TRENDS)) return;
    for (const name of [OLD_SUMMARY, SUMMARY, TRENDS]) {
      const old = book().getSheetByName(name);
      if (old) book().deleteSheet(old);
    }
    buildSummary();
    buildTrends();
    if (current < 6) upgradeAccounts();
    if (current < 8) moveSubscriptions(tx);
    if (current < 9) {
      resetColours(tx);
      tx.getRange(1, C.Note + 1).setValue("Note").setFontWeight("bold");
      book().getSheetByName(RULES).getRange(1, 4).setValue("Note").setFontWeight("bold");
      dedupeGenericLines();
      recategorise();
      props.deleteProperty("aiTried");
      orderTabs();
    }
    if (current < 10) {
      recategorise();
      buildReview();
    }
    props.setProperty("layout", String(LAYOUT_VERSION));
  }
  function orderTabs() {
    TAB_ORDER.forEach((name, i) => {
      const sheet = book().getSheetByName(name);
      if (!sheet) return;
      book().setActiveSheet(sheet);
      book().moveActiveSheet(i + 1);
    });
    book().setActiveSheet(book().getSheetByName(SUMMARY));
  }
  function categoryDropdown(tx) {
    tx.getRange("F2:F").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([...DEFAULT_CATEGORIES], true).setAllowInvalid(true).build());
  }
  function moveSubscriptions(tx) {
    categoryDropdown(tx);
    const rules = book().getSheetByName(RULES);
    const ruleRows = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 3).getValues() : [];
    const chosen = new Set(ruleRows.filter((r) => r[2] !== "Gemini").map((r) => String(r[0])));
    ruleRows.forEach((r, i) => {
      if (r[2] === "Gemini" && SUBSCRIPTION.test(String(r[0]))) rules.getRange(i + 2, 2).setValue("Subscriptions");
    });
    const n = tx.getLastRow() - 1;
    if (n < 1) return;
    const rows = tx.getRange(2, 1, n, HEADERS.length).getValues();
    const cats = rows.map((r) => {
      const guessed = ["Entertainment", "Uncategorised"].includes(String(r[C.Category])) && !chosen.has(String(r[C["Merchant key"]]));
      return [guessed && r[C.Direction] === "out" && SUBSCRIPTION.test(`${r[C.Merchant]} ${r[C.Description]}`) ? "Subscriptions" : r[C.Category]];
    });
    tx.getRange(2, C.Category + 1, n, 1).setValues(cats);
  }
  function resetColours(tx) {
    const ours = /^=\$E2="(in|out)"$/;
    const kept = tx.getConditionalFormatRules().filter((r) => {
      var _a, _b, _c;
      return !ours.test(String((_c = (_b = (_a = r.getBooleanCondition()) == null ? void 0 : _a.getCriteriaValues()) == null ? void 0 : _b[0]) != null ? _c : ""));
    });
    tx.setConditionalFormatRules(kept);
    colourDirections(tx);
  }
  function colourDirections(tx) {
    const rule = (direction2, font, fill) => SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=$E2="${direction2}"`).setFontColor(font).setBackground(fill).setRanges([tx.getRange("C2:C"), tx.getRange("E2:E")]).build();
    tx.setConditionalFormatRules([...tx.getConditionalFormatRules(), rule("in", "#137333", "#e6f4ea"), rule("out", "#a50e0e", "#fce8e6")]);
  }
  var T = `'${TX}'`;
  var between = (from, to) => `${T}!A:A,">="&${from},${T}!A:A,"<"&${to}`;
  var sumIn = (cats, from, to) => `(${cats.map((c) => `SUMIFS(${T}!C:C,${T}!E:E,"in",${T}!F:F,"${c}",${between(from, to)})`).join("+")})`;
  var spentF = (from, to) => `SUMIFS(${T}!C:C,${T}!E:E,"out",${T}!F:F,"<>Own transfers",${between(from, to)})`;
  var backF = (from, to) => sumIn(RETURNED, from, to);
  var incomeF = (from, to) => sumIn(EARNED, from, to);
  var money = "#,##0.00";
  function buildSummary() {
    const s = book().insertSheet(SUMMARY, 0);
    const t = T;
    const month = ["$B$1", "EDATE($B$1,1)"];
    const from = `TEXT($B$1,"yyyy-mm-dd")`;
    const to = `TEXT(EDATE($B$1,1),"yyyy-mm-dd")`;
    const inMonth = `A >= datetime '"&${from}&" 00:00:00' and A < datetime '"&${to}&" 00:00:00'`;
    const months = `ARRAYFORMULA(IF(${t}!A2:A="",,EOMONTH(${t}!A2:A,-1)+1))`;
    s.getRange("Z1").setValue("Months");
    s.getRange("Z2").setFormula(`=SORT(UNIQUE(FILTER(${months},${months}<>"")),1,FALSE)`);
    s.getRange("Z2:Z").setNumberFormat("mmm yyyy");
    s.hideColumns(26);
    s.setColumnWidth(1, 200);
    s.getRange("A1").setValue("Month").setFontWeight("bold");
    s.getRange("B1").setFormula(`=IF(COUNT(${t}!A2:A),EOMONTH(MAX(${t}!A2:A),-1)+1,DATE(YEAR(TODAY()),MONTH(TODAY()),1))`).setNumberFormat("mmm yyyy").setFontWeight("bold").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(s.getRange("Z2:Z"), true).setAllowInvalid(true).build());
    s.getRange("C1").setValue("Pick a month to see it below. Net spent = spent minus what came back to you.");
    s.getRange("A3:H3").setValues([["Spent", "Paid back & refunds", "Net spent", "Income", "Saved", "Savings rate", "vs last 3 months", "Balance now (est.)"]]).setFontWeight("bold");
    s.getRange("A4").setFormula(`=${spentF(...month)}`);
    s.getRange("B4").setFormula(`=${backF(...month)}`);
    s.getRange("C4").setFormula("=A4-B4");
    s.getRange("D4").setFormula(`=${incomeF(...month)}`);
    s.getRange("E4").setFormula("=D4-C4");
    s.getRange("F4").setFormula(`=IF(D4>0,E4/D4,"")`);
    s.getRange("G4").setFormula(`=IFERROR(C4/((${spentF("EDATE($B$1,-3)", "$B$1")}-${backF("EDATE($B$1,-3)", "$B$1")})/3)-1,"")`);
    s.getRange("H4").setFormula(`=SUM('${ACCOUNTS}'!D2:D)`);
    s.getRange("A4:H4").setFontSize(14).setFontWeight("bold").setNumberFormat(money);
    s.getRange("F4:G4").setNumberFormat("+0%;-0%;0%");
    s.getRange("A6").setValue("Where it went").setFontWeight("bold");
    s.getRange("A7").setFormula(
      `=IFERROR(QUERY(${t}!A:F,"select F, sum(C) where E = 'out' and F <> 'Own transfers' and ${inMonth} group by F order by sum(C) desc label F 'Category', sum(C) 'Spent'",1),"Nothing this month")`
    );
    s.getRange("B8:B24").setNumberFormat(money);
    s.getRange("A27").setValue("Money in").setFontWeight("bold");
    s.getRange("A28").setFormula(
      `=IFERROR(QUERY(${t}!A:F,"select F, sum(C) where E = 'in' and F <> 'Own transfers' and ${inMonth} group by F order by sum(C) desc label F 'Kind', sum(C) 'Amount'",1),"Nothing this month")`
    );
    s.getRange("B29:B34").setNumberFormat(money);
    s.getRange("A37").setValue("Biggest payments").setFontWeight("bold");
    s.getRange("A38").setFormula(
      `=IFERROR(QUERY(${t}!A:F,"select B, C, F, A where E = 'out' and F <> 'Own transfers' and ${inMonth} order by C desc limit 8 label B 'Merchant', C 'Amount', F 'Category', A 'Date'",1),"Nothing this month")`
    );
    s.getRange("B39:B46").setNumberFormat(money);
    s.getRange("D39:D46").setNumberFormat("d mmm");
    const thisMonth = "(EOMONTH(TODAY(),-1)+1)";
    const startM = `MAX(EDATE(${thisMonth},-11),EOMONTH(MIN(${t}!A2:A),-1)+1)`;
    const m = "A50:A61";
    s.getRange("A48").setValue("Last 12 months").setFontWeight("bold");
    s.getRange("A49:D49").setValues([["Month", "Income", "Net spent", "Saved"]]).setFontWeight("bold");
    s.getRange("A50").setFormula(`=IF(COUNT(${t}!A2:A),ARRAYFORMULA(EDATE(${startM},SEQUENCE(DATEDIF(${startM},${thisMonth},"M")+1,1,0))),)`);
    s.getRange("B50").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${incomeF("x", "EDATE(x,1)")})))`);
    s.getRange("C50").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${spentF("x", "EDATE(x,1)")}-${backF("x", "EDATE(x,1)")})))`);
    s.getRange("D50").setFormula(`=MAP(B50:B61,C50:C61,LAMBDA(i,o,IF(i="",,i-o)))`);
    s.getRange(m).setNumberFormat("mmm yyyy");
    s.getRange("B50:D61").setNumberFormat(money);
    const chart = (type, row, title, ranges) => {
      let b = s.newChart().setChartType(type).setNumHeaders(1).setPosition(row, 5, 0, 0).setOption("title", title).setOption("width", 560).setOption("height", 340);
      for (const r of ranges) b = b.addRange(s.getRange(r));
      return b;
    };
    s.insertChart(chart(Charts.ChartType.BAR, 6, "Where it went this month", ["A7:B24"]).setOption("legend", { position: "none" }).setOption("colors", ["#c5221f"]).build());
    s.insertChart(
      chart(Charts.ChartType.COLUMN, 27, "Income and net spent, last 12 months", ["A49:C61"]).setOption("legend", { position: "bottom" }).setOption("colors", ["#137333", "#c5221f"]).build()
    );
  }
  function buildTrends() {
    const s = book().insertSheet(TRENDS, 1);
    const t = `'${TX}'`;
    const thisMonth = "(EOMONTH(TODAY(),-1)+1)";
    const total = (dir, from, to) => dir === "in" ? incomeF(from, to) : `(${spentF(from, to)}-${backF(from, to)})`;
    const spend = `${t}!E2:E="out",${t}!F2:F<>"Own transfers"`;
    const earliest = `MIN(${t}!A2:A)`;
    const firstFull = `IF(DAY(${earliest})=1,EOMONTH(${earliest},-1)+1,EOMONTH(${earliest},0)+1)`;
    const avgFrom = `EDATE(${thisMonth},-B8)`;
    s.getRange("A1").setValue("Trends").setFontWeight("bold");
    s.getRange("A2").setValue(
      "Spent here is net: what you paid, minus friends paying you back and refunds. Income is what you earned or were given. Transfers between your own accounts are left out."
    );
    s.getRange("A4:B12").setValues([
      ["Spent this month", ""],
      ["Per day this month", ""],
      ["On pace for", ""],
      ["", ""],
      ["Full months averaged (up to 3)", ""],
      ["Average net spent per month", ""],
      ["Average net spent per day", ""],
      ["Average income per month", ""],
      ["Average left over per month", ""]
    ]);
    s.getRange("B4").setFormula(`=${total("out", thisMonth, `EDATE(${thisMonth},1)`)}`);
    s.getRange("B5").setFormula(`=B4/DAY(TODAY())`);
    s.getRange("B6").setFormula(`=B5*DAY(EOMONTH(TODAY(),0))`);
    s.getRange("B8").setFormula(`=IF(COUNT(${t}!A2:A),MAX(0,MIN(3,DATEDIF(${firstFull},${thisMonth},"M"))),0)`);
    s.getRange("B9").setFormula(`=IF(B8,${total("out", avgFrom, thisMonth)}/B8,"Not enough data")`);
    s.getRange("B10").setFormula(`=IF(B8,${total("out", avgFrom, thisMonth)}/(${thisMonth}-${avgFrom}),"")`);
    s.getRange("B11").setFormula(`=IF(B8,${total("in", avgFrom, thisMonth)}/B8,"")`);
    s.getRange("B12").setFormula(`=IF(B8,B11-B9,"")`);
    s.getRange("B4:B12").setNumberFormat("#,##0.00");
    s.getRange("B8").setNumberFormat("0");
    const start = `MAX(EDATE(${thisMonth},-11),EOMONTH(${earliest},-1)+1)`;
    const m = "A15:A26";
    s.getRange("A14:C14").setValues([["Month", "Income", "Net spent"]]).setFontWeight("bold");
    s.getRange("A15").setFormula(`=IF(COUNT(${t}!A2:A),ARRAYFORMULA(EDATE(${start},SEQUENCE(DATEDIF(${start},${thisMonth},"M")+1,1,0))),)`);
    s.getRange("B15").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${total("in", "x", "EDATE(x,1)")})))`);
    s.getRange("C15").setFormula(`=MAP(${m},LAMBDA(x,IF(x="",,${total("out", "x", "EDATE(x,1)")})))`);
    s.getRange(m).setNumberFormat("mmm yyyy");
    s.getRange("B15:C26").setNumberFormat("#,##0.00");
    s.getRange("A29").setValue("Top merchants, last 90 days").setFontWeight("bold");
    s.getRange("A30").setFormula(
      `=IFERROR(QUERY(FILTER({${t}!B2:B,${t}!C2:C},${spend},${t}!A2:A>=TODAY()-90),"select Col1, count(Col2), sum(Col2) group by Col1 order by sum(Col2) desc limit 15 label Col1 'Merchant', count(Col2) 'Times', sum(Col2) 'Spent'",0),"Nothing yet")`
    );
    s.getRange("C31:C45").setNumberFormat("#,##0.00");
    s.getRange("A48").setValue("By day of the week").setFontWeight("bold");
    s.getRange("A49:C49").setValues([["Day", "Spent", "Average per day"]]).setFontWeight("bold");
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day, i) => {
      const r = 50 + i;
      const isDay = `(WEEKDAY(${t}!A2:A,2)=${i + 1})`;
      s.getRange(r, 1).setValue(day);
      s.getRange(r, 2).setFormula(`=SUMPRODUCT((${t}!E2:E="out")*(${t}!F2:F<>"Own transfers")*${isDay}*${t}!C2:C)`);
      s.getRange(r, 3).setFormula(
        `=IF(COUNT(${t}!A2:A),B${r}/MAX(1,SUMPRODUCT(--(WEEKDAY(SEQUENCE(INT(MAX(${t}!A2:A))-INT(MIN(${t}!A2:A))+1,1,INT(MIN(${t}!A2:A))),2)=${i + 1}))),)`
      );
    });
    s.getRange("B50:C56").setNumberFormat("#,##0.00");
    s.getRange("A60").setValue("Categories by month").setFontWeight("bold");
    s.getRange("A61").setFormula(
      `=IFERROR(QUERY(FILTER({ARRAYFORMULA(EOMONTH(${t}!A2:A,-1)+1),${t}!C2:C,${t}!F2:F},${spend},${t}!A2:A>=EDATE(${thisMonth},-11)),"select Col1, sum(Col2) group by Col1 pivot Col3 order by Col1 label Col1 'Month'",0),"Nothing yet")`
    );
    s.getRange("A62:A73").setNumberFormat("mmm yyyy");
    s.getRange("B62:P73").setNumberFormat("#,##0.00");
    s.setColumnWidth(1, 220);
    const chart = (type, row, title, ranges) => {
      let b = s.newChart().setChartType(type).setNumHeaders(1).setPosition(row, 5, 0, 0).setOption("title", title).setOption("legend", { position: "bottom" });
      for (const r of ranges) b = b.addRange(s.getRange(r));
      return b;
    };
    s.insertChart(chart(Charts.ChartType.COLUMN, 4, "Income and net spent by month", ["A14:C26"]).setOption("colors", ["#137333", "#c5221f"]).build());
    s.insertChart(chart(Charts.ChartType.COLUMN, 24, "Spending by category", ["A61:P73"]).setOption("isStacked", true).build());
    s.insertChart(chart(Charts.ChartType.BAR, 44, "Top merchants, last 90 days", ["A30:A45", "C30:C45"]).setOption("legend", { position: "none" }).build());
  }
  function context() {
    var _a, _b;
    const rules = book().getSheetByName(RULES);
    const userRules = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 2).getValues().map((r) => ({ merchantKey: String(r[0]), category: String(r[1]) })) : [];
    const settings = book().getSheetByName(SETTINGS);
    const ownNames = String((_a = settings.getRange("B2").getValue()) != null ? _a : "").split(",");
    const allowanceNames = String((_b = settings.getRange("B7").getValue()) != null ? _b : "").split(",");
    const start = settings.getRange("B6").getValue();
    const startDate = start instanceof Date ? start : /^\d{4}-\d{2}-\d{2}$/.test(String(start).trim()) ? /* @__PURE__ */ new Date(`${String(start).trim()}T00:00:00+08:00`) : null;
    return { userRules, ownNames, allowanceNames, startDate };
  }
  function loadTransactions() {
    const sheet = book().getSheetByName(TX);
    const n = sheet.getLastRow() - 1;
    const rows = n > 0 ? sheet.getRange(2, 1, n, HEADERS.length).getValues() : [];
    const keys = new Set(rows.flatMap((r) => [r[C.Key], r[C["Statement key"]]]).filter(Boolean).map(String));
    return { sheet, rows, keys };
  }
  function candidates(rows, source) {
    const out = [];
    rows.forEach((r, id) => {
      if (r[C.Source] !== source) return;
      out.push({
        id,
        at: r[C.Date].getTime(),
        amountCents: Math.round(Number(r[C.Amount]) * 100),
        direction: r[C.Direction] === "out" ? "debit" : "credit",
        merchantKey: String(r[C["Merchant key"]]),
        account: String(r[C.Account])
      });
    });
    return out;
  }
  function toRow(e, category, origin) {
    var _a, _b, _c;
    const t = e.txn;
    const row = [];
    row[C.Date] = new Date(t.occurredAt);
    row[C.Merchant] = t.merchant;
    row[C.Amount] = t.amountCents / 100;
    row[C.Currency] = t.currency;
    row[C.Direction] = t.direction === "debit" ? "out" : "in";
    row[C.Category] = category;
    row[C.Account] = t.account;
    row[C.Type] = t.kind;
    row[C.Description] = (_a = t.description) != null ? _a : "";
    row[C.Source] = origin;
    row[C.Reference] = (_b = t.reference) != null ? _b : "";
    row[C["Merchant key"]] = normaliseMerchant(t.merchant);
    row[C.Key] = e.key;
    row[C["Statement key"]] = (_c = e.stmtKey) != null ? _c : "";
    row[C.Note] = "";
    return row;
  }
  function record(entries, origin) {
    var _a, _b;
    const { sheet, rows, keys } = loadTransactions();
    const { userRules, ownNames, allowanceNames, startDate } = context();
    const other = candidates(rows, origin === "email" ? "statement" : "email");
    const cat = (t) => withReversal(t, categorise(t, userRules, ownNames, allowanceNames), userRules, [...rows, ...added]);
    const used = /* @__PURE__ */ new Set();
    const added = [];
    let matched = 0;
    let skipped = 0;
    for (const e of entries) {
      if (keys.has(e.key)) {
        skipped++;
        continue;
      }
      if (startDate && Date.parse(e.txn.occurredAt) < startDate.getTime()) continue;
      keys.add(e.key);
      const t = e.txn;
      const m = findMatch(
        { at: Date.parse(t.occurredAt), amountCents: t.amountCents, direction: t.direction, merchantKey: normaliseMerchant(t.merchant), account: t.account },
        other,
        used
      );
      if (m) {
        used.add(m.id);
        const row = rows[m.id];
        row[C.Source] = "both";
        if (origin === "email") {
          row[C.Date] = new Date(t.occurredAt);
          row[C.Reference] = (_a = t.reference) != null ? _a : "";
          row[C.Key] = e.key;
          if (isGeneric(String(row[C["Merchant key"]]))) {
            row[C.Merchant] = t.merchant;
            row[C["Merchant key"]] = normaliseMerchant(t.merchant);
            row[C.Category] = cat(t);
          }
        } else {
          row[C["Statement key"]] = (_b = e.stmtKey) != null ? _b : "";
        }
        matched++;
        continue;
      }
      added.push(toRow(e, cat(t), origin));
    }
    if (matched) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    if (added.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, added.length, HEADERS.length).setValues(added);
      sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).sort({ column: C.Date + 1, ascending: false });
    }
    return { added: added.length, matched, skipped };
  }
  function withReversal(t, category, userRules, rows) {
    if (t.direction !== "credit" || category === "Own transfers" || userRules.some((r) => r.merchantKey === normaliseMerchant(t.merchant))) return category;
    const at = Date.parse(t.occurredAt);
    const words2 = normaliseMerchant(t.merchant).split(" ").filter((w) => w.length >= 3);
    const paid = rows.some(
      (r) => r[C.Direction] === "out" && Math.round(Number(r[C.Amount]) * 100) === t.amountCents && r[C.Date] instanceof Date && at - r[C.Date].getTime() >= -DAY3 && at - r[C.Date].getTime() <= 30 * DAY3 && String(r[C["Merchant key"]]).split(" ").some((w) => words2.includes(w))
    );
    if (paid) return "Refunds";
    if (category === "Paid back") {
      const key = normaliseMerchant(t.merchant);
      const months = new Set(
        rows.filter((r) => r[C.Direction] === "in" && r[C["Merchant key"]] === key && r[C.Date] instanceof Date).map((r) => ymd(r[C.Date]).slice(0, 7))
      );
      months.add(t.occurredAt.slice(0, 7));
      if (months.size >= 3) return "Allowance";
    }
    return category;
  }
  function writeRows(sheet, rows, before) {
    if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    if (before > rows.length) sheet.deleteRows(2 + rows.length, before - rows.length);
  }
  function pruneBeforeStart() {
    const { startDate } = context();
    if (!startDate) return;
    const { sheet, rows } = loadTransactions();
    const kept = rows.filter((r) => !(r[C.Date] instanceof Date) || r[C.Date].getTime() >= startDate.getTime());
    if (kept.length < rows.length) writeRows(sheet, kept, rows.length);
  }
  function dedupeGenericLines() {
    const { sheet, rows } = loadTransactions();
    const drop = /* @__PURE__ */ new Set();
    rows.forEach((r, i) => {
      if (r[C.Source] !== "statement" || !isGeneric(String(r[C["Merchant key"]])) || !(r[C.Date] instanceof Date)) return;
      const j = rows.findIndex(
        (o, k) => k !== i && !drop.has(k) && o[C.Source] === "email" && o[C.Account] === r[C.Account] && o[C.Direction] === r[C.Direction] && Number(o[C.Amount]) === Number(r[C.Amount]) && o[C.Date] instanceof Date && Math.abs(o[C.Date].getTime() - r[C.Date].getTime()) < 2 * DAY3
      );
      if (j < 0) return;
      rows[j][C.Source] = "both";
      rows[j][C["Statement key"]] = r[C["Statement key"]];
      drop.add(i);
    });
    if (drop.size) writeRows(sheet, rows.filter((_, i) => !drop.has(i)), rows.length);
  }
  function chosenKeys() {
    const rules = book().getSheetByName(RULES);
    const rows = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 3).getValues() : [];
    return new Set(rows.filter((r) => r[2] !== "Gemini").map((r) => String(r[0])));
  }
  function recategorise() {
    const { sheet, rows } = loadTransactions();
    const { userRules, ownNames, allowanceNames } = context();
    const chosen = chosenKeys();
    let changed = false;
    rows.forEach((r) => {
      if (chosen.has(String(r[C["Merchant key"]]))) return;
      const t = {
        merchant: String(r[C.Merchant]),
        description: String(r[C.Description]) || null,
        payeeType: "unknown",
        kind: String(r[C.Type])
      };
      let next = r[C.Category];
      if (r[C.Direction] === "in" && (r[C.Category] === "Income" || r[C.Category] === "Paid back")) {
        const at = r[C.Date] instanceof Date ? r[C.Date].toISOString() : "";
        const full = { ...t, direction: "credit", amountCents: Math.round(Number(r[C.Amount]) * 100), occurredAt: at };
        next = withReversal(full, categorise(full, userRules, ownNames, allowanceNames), userRules, rows);
      } else if (r[C.Direction] === "out" && r[C.Category] === "Gifts" && /e-?Packet/i.test(String(r[C.Description]))) {
        next = categorise({ ...t, payeeType: "person" }, userRules, ownNames);
      }
      if (next !== r[C.Category]) {
        r[C.Category] = next;
        changed = true;
      }
    });
    if (changed) sheet.getRange(2, C.Category + 1, rows.length, 1).setValues(rows.map((r) => [r[C.Category]]));
  }
  var REVIEW_SIZE = 15;
  var REVIEW_HEADERS = ["Merchant", "Category", "Set by", "Payments", "Total", "Last paid", "Example", "Your note", "Merchant key"];
  function buildReview() {
    var _a;
    const { rows } = loadTransactions();
    const rules = book().getSheetByName(RULES);
    const ruleRows = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 3).getValues() : [];
    const setBy = new Map(ruleRows.map((r) => [String(r[0]), String(r[2]) || "you"]));
    const groups = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const key = String(r[C["Merchant key"]]);
      if (!key || r[C.Category] === "Own transfers" || !(r[C.Date] instanceof Date)) continue;
      const g = groups.get(key);
      const amount = Number(r[C.Amount]);
      if (!g) groups.set(key, { merchant: String(r[C.Merchant]), category: String(r[C.Category]), count: 1, total: amount, last: r[C.Date], example: String(r[C.Description]) });
      else {
        g.count++;
        g.total += amount;
      }
    }
    const pick = [...groups.entries()].filter(([key]) => setBy.get(key) !== "you").map(([key, g]) => ({ key, g, draw: Math.random() ** (1 / Math.sqrt(g.total + 1)) })).sort((a, b) => b.draw - a.draw).slice(0, REVIEW_SIZE).sort((a, b) => b.g.total - a.g.total);
    const s = (_a = book().getSheetByName(REVIEW)) != null ? _a : book().insertSheet(REVIEW);
    s.clearContents();
    s.getRange(1, 1, 1, REVIEW_HEADERS.length).setValues([REVIEW_HEADERS]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.setColumnWidth(1, 220);
    s.setColumnWidth(7, 260);
    s.hideColumns(REVIEW_HEADERS.length);
    const out = pick.map(({ key, g }) => {
      var _a2;
      return [g.merchant, g.category, (_a2 = setBy.get(key)) != null ? _a2 : "built-in", g.count, g.total, g.last, g.example, "", key];
    });
    if (out.length) s.getRange(2, 1, out.length, REVIEW_HEADERS.length).setValues(out);
    s.getRange("B2:B").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([...DEFAULT_CATEGORIES], true).setAllowInvalid(true).build());
    s.getRange("E2:E").setNumberFormat(money);
    s.getRange("F2:F").setNumberFormat("yyyy-mm-dd");
    s.getRange("K1:K2").setValues([
      ["Check these. Change a category and every payment to that merchant follows. Add a note to remember why."],
      ["For a new random set: ugotmonee > Review random merchants."]
    ]);
  }
  function reviewMerchants() {
    ensureSheets();
    buildReview();
    book().setActiveSheet(book().getSheetByName(REVIEW));
  }
  function reviewEdited(row, column, value) {
    const s = book().getSheetByName(REVIEW);
    const [category, key] = [String(s.getRange(row, 2).getValue()), String(s.getRange(row, REVIEW_HEADERS.length).getValue())];
    if (!key) return;
    if (column === 2 && value) {
      saveRules(/* @__PURE__ */ new Map([[key, value]]), "you");
      applyCategory(key, value);
      s.getRange(row, 3).setValue("you");
    } else if (column === 8) {
      saveRules(/* @__PURE__ */ new Map([[key, category]]), "you", value);
      s.getRange(row, 3).setValue("you");
    }
  }
  function applyCategory(key, category) {
    const sheet = book().getSheetByName(TX);
    const n = sheet.getLastRow() - 1;
    if (n < 1) return;
    const rows = sheet.getRange(2, 1, n, HEADERS.length).getValues();
    sheet.getRange(2, C.Category + 1, n, 1).setValues(rows.map((r) => [r[C["Merchant key"]] === key && r[C.Category] !== "Own transfers" ? category : r[C.Category]]));
  }
  function buildRecurring() {
    var _a;
    const { rows } = loadTransactions();
    const spends = [];
    let coveredUntil = 0;
    for (const r of rows) {
      const date2 = r[C.Date];
      if (!(date2 instanceof Date)) continue;
      const at = date2.getTime();
      if (r[C.Source] !== "email") coveredUntil = Math.max(coveredUntil, at + DAY3);
      if (r[C.Direction] !== "out" || r[C.Category] === "Own transfers") continue;
      spends.push({ at, merchant: String(r[C.Merchant]), merchantKey: String(r[C["Merchant key"]]), amount: Number(r[C.Amount]), category: String(r[C.Category]) });
    }
    const found = findRecurring(spends, Date.now(), coveredUntil);
    const s = (_a = book().getSheetByName(RECURRING)) != null ? _a : book().insertSheet(RECURRING, 2);
    s.clearContents();
    const headers = ["Merchant", "Kind", "Category", "Usual amount", "Every", "Times", "Last paid", "Next expected", "Per month", "Note"];
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    s.setFrozenRows(1);
    s.setColumnWidth(1, 220);
    const date = (ms) => ms ? new Date(ms) : "";
    const out = found.map((f) => [
      f.merchant,
      f.kind,
      f.category,
      f.amount,
      f.every,
      f.times,
      date(f.last),
      date(f.nextExpected),
      f.perMonth,
      f.overdue ? `Not in your statements since ${ymd(new Date(f.last))}: cancelled, or paid another way?` : ""
    ]);
    if (out.length) s.getRange(2, 1, out.length, headers.length).setValues(out);
    s.getRange("D2:D").setNumberFormat("#,##0.00");
    s.getRange("I2:I").setNumberFormat("#,##0.00");
    s.getRange("G2:H").setNumberFormat("yyyy-mm-dd");
    const subs = found.filter((f) => f.kind === "Subscription" && !f.overdue).reduce((a, f) => a + f.perMonth, 0);
    const all = found.filter((f) => !f.overdue).reduce((a, f) => a + f.perMonth, 0);
    s.getRange("L1:M3").setValues([
      ["Subscriptions per month", subs],
      ["All recurring per month", all],
      ["Found from repeat payments of about the same amount at a steady interval, plus known subscription services.", ""]
    ]);
    s.getRange("M1:M2").setNumberFormat("#,##0.00");
  }
  function decode(data) {
    if (!data || !data.length) return "";
    const bytes = typeof data === "string" ? Utilities.base64DecodeWebSafe(data.padEnd(Math.ceil(data.length / 4) * 4, "=")) : data;
    return Utilities.newBlob(bytes).getDataAsString("UTF-8");
  }
  function findBody(part, mime) {
    var _a, _b;
    if (!part) return "";
    if (part.mimeType === mime && ((_a = part.body) == null ? void 0 : _a.data)) return decode(part.body.data);
    for (const p of (_b = part.parts) != null ? _b : []) {
      const found = findBody(p, mime);
      if (found) return found;
    }
    return "";
  }
  function toRawEmail(msg) {
    const header = (name) => {
      var _a, _b, _c, _d;
      return (_d = (_c = (_b = (_a = msg.payload) == null ? void 0 : _a.headers) == null ? void 0 : _b.find((h) => {
        var _a2;
        return ((_a2 = h.name) == null ? void 0 : _a2.toLowerCase()) === name;
      })) == null ? void 0 : _c.value) != null ? _d : void 0;
    };
    const plain = findBody(msg.payload, "text/plain").trim();
    return {
      from: header("from"),
      subject: header("subject"),
      text: plain || htmlToText(findBody(msg.payload, "text/html")),
      receivedAt: new Date(Number(msg.internalDate))
    };
  }
  function sync() {
    var _a, _b, _c, _d, _e;
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1e4)) return { added: 0, matched: 0, skipped: 0, more: true };
    try {
      ensureSheets();
      pruneBeforeStart();
      const started = Date.now();
      const props = PropertiesService.getScriptProperties();
      let cursor = Number(props.getProperty("cursor")) || started - BACKFILL_DAYS * DAY3;
      if (props.getProperty("backfill") !== String(BACKFILL_DAYS)) {
        cursor = Math.min(cursor, started - BACKFILL_DAYS * DAY3);
        props.setProperty("backfill", String(BACKFILL_DAYS));
      }
      const q = `${QUERY} after:${Math.floor(cursor / 1e3) - 3600}`;
      const ids = [];
      let pageToken;
      do {
        const page = Gmail.Users.Messages.list("me", { q, maxResults: 500, pageToken });
        for (const m of (_a = page.messages) != null ? _a : []) ids.push(m.id);
        pageToken = (_b = page.nextPageToken) != null ? _b : void 0;
      } while (pageToken);
      ids.reverse();
      const unrecognised = book().getSheetByName(UNRECOGNISED);
      const oldRows = unrecognised.getLastRow() > 1 ? unrecognised.getRange(2, 1, unrecognised.getLastRow() - 1, 5).getValues() : [];
      const seen = new Set(oldRows.map((r) => String(r[3])));
      const retry = props.getProperty("parsers") !== String(PARSER_VERSION);
      if (retry) {
        const fresh = new Set(ids);
        ids.unshift(...oldRows.map((r) => String(r[3])).filter((id) => id && !fresh.has(id)));
        seen.clear();
      }
      const done = /* @__PURE__ */ new Set();
      const entries = [];
      const unknown = [];
      let last = cursor;
      let more = false;
      for (const id of ids) {
        if (Date.now() - started > TIME_BUDGET) {
          more = true;
          break;
        }
        let email;
        try {
          email = toRawEmail(Gmail.Users.Messages.get("me", id, { format: "full" }));
        } catch (err) {
          if (/quota|rate limit/i.test(String(err))) {
            more = true;
            break;
          }
          done.add(id);
          if (!seen.has(id)) unknown.push([/* @__PURE__ */ new Date(), "", "", id, `Couldn't read this email: ${err}`]);
          continue;
        }
        done.add(id);
        last = Math.max(last, email.receivedAt.getTime());
        const r = parseEmail(email);
        if (r.status === "parsed") entries.push({ txn: r.txn, key: dedupKey(r.txn) });
        else if (r.status === "unrecognised" && MONEY.test(email.text) && !seen.has(id))
          unknown.push([email.receivedAt, (_c = email.from) != null ? _c : "", (_d = email.subject) != null ? _d : "", id, email.text.slice(0, 2e3)]);
      }
      const result = record(entries, "email");
      if (retry) {
        const keep = [...oldRows.filter((r) => !done.has(String(r[3]))), ...unknown];
        if (oldRows.length) unrecognised.deleteRows(2, oldRows.length);
        if (keep.length) unrecognised.getRange(2, 1, keep.length, 5).setValues(keep);
        if (!more) props.setProperty("parsers", String(PARSER_VERSION));
      } else if (unknown.length) unrecognised.getRange(unrecognised.getLastRow() + 1, 1, unknown.length, 5).setValues(unknown);
      props.setProperty("cursor", String(last));
      buildRecurring();
      if (Date.now() - started < TIME_BUDGET + 6e4) aiCategorise();
      setSyncStatus(`OK. ${result.added} new, ${result.matched} matched, ${result.skipped} already had${more ? ", more still loading" : ""}.`);
      return { ...result, more };
    } catch (err) {
      setSyncStatus(`Failed: ${err instanceof Error ? (_e = err.stack) != null ? _e : err.message : err}`.slice(0, 1e3));
      throw err;
    } finally {
      lock.releaseLock();
    }
  }
  function setSyncStatus(text) {
    var _a;
    try {
      const stamp = Utilities.formatDate(/* @__PURE__ */ new Date(), "Asia/Singapore", "yyyy-MM-dd HH:mm");
      (_a = book().getSheetByName(SETTINGS)) == null ? void 0 : _a.getRange(5, 1, 1, 2).setValues([["Last sync", `${stamp} ${text}`]]);
    } catch {
    }
  }
  function onOpen() {
    SpreadsheetApp.getUi().createMenu("ugotmonee").addItem("Set up", "setup").addItem("Sync emails now", "syncNow").addItem("Import statement (PDF)\u2026", "showImport").addItem("Update balance\u2026", "updateBalances").addItem("Review random merchants", "reviewMerchants").addSeparator().addItem("Categorise with Gemini\u2026", "setGeminiKey").addToUi();
  }
  function setup() {
    book().setSpreadsheetTimeZone("Asia/Singapore");
    ensureSheets();
    for (const t of ScriptApp.getProjectTriggers())
      if (["sync", "remindStatements"].includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
    ScriptApp.newTrigger("sync").timeBased().everyMinutes(5).create();
    ScriptApp.newTrigger("remindStatements").timeBased().onMonthDay(8).atHour(9).create();
    const r = sync();
    const message = `Done. Found ${r.added} transactions in the last ${BACKFILL_DAYS} days of bank emails.` + (r.more ? " There are more; they'll keep loading every 5 minutes." : "") + "\n\nNew alerts are checked every 5 minutes. Change a category and future payments to that merchant follow it. On the 8th of each month you'll get an email if last month's statements haven't been imported.";
    try {
      SpreadsheetApp.getUi().alert(message);
    } catch {
      console.log(message);
    }
  }
  function syncNow() {
    const r = sync();
    book().toast(`${r.added} new, ${r.matched} matched to statement lines.${r.more ? " More still loading." : ""}`, "ugotmonee");
  }
  function onEdit(e) {
    var _a, _b;
    const range = e.range;
    const sheet = range.getSheet();
    if (sheet.getName() === SETTINGS && range.getColumn() === 2 && (range.getRow() === 2 || range.getRow() === 7)) return markOwnTransfers();
    if (sheet.getName() === REVIEW && range.getRow() >= 2 && range.getNumRows() === 1) return reviewEdited(range.getRow(), range.getColumn(), String((_a = e.value) != null ? _a : "").trim());
    if (sheet.getName() !== TX || range.getColumn() !== C.Category + 1 || range.getNumRows() !== 1 || range.getRow() < 2) return;
    const category = String((_b = e.value) != null ? _b : "").trim();
    const key = String(sheet.getRange(range.getRow(), C["Merchant key"] + 1).getValue());
    if (!category || !key) return;
    const learned = /* @__PURE__ */ new Map([[key, category]]);
    saveRules(learned, "you");
    fillCategories(learned);
  }
  function markOwnTransfers() {
    const { ownNames, allowanceNames } = context();
    const sheet = book().getSheetByName(TX);
    const n = sheet.getLastRow() - 1;
    if (n < 1) return;
    const guessed = ["Transfers", "Income", "Paid back", "Uncategorised"];
    const cats = sheet.getRange(2, 1, n, HEADERS.length).getValues().map((r) => {
      const merchant = String(r[C.Merchant]);
      if (!guessed.includes(String(r[C.Category]))) return [r[C.Category]];
      if (isOwnName(merchant, ownNames)) return ["Own transfers"];
      if (r[C.Direction] === "in" && isOwnName(merchant, allowanceNames)) return ["Allowance"];
      return [r[C.Category]];
    });
    sheet.getRange(2, C.Category + 1, n, 1).setValues(cats);
  }
  function saveRules(learned, by, note) {
    const rules = book().getSheetByName(RULES);
    const keys = rules.getLastRow() > 1 ? rules.getRange(2, 1, rules.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
    for (const [key, category] of learned) {
      const i = keys.indexOf(key);
      if (i >= 0) rules.getRange(i + 2, 2, 1, 2).setValues([[category, by]]);
      else {
        rules.appendRow([key, category, by]);
        keys.push(key);
      }
      if (note !== void 0) rules.getRange(keys.indexOf(key) + 2, 4).setValue(note);
    }
  }
  function fillCategories(learned) {
    const sheet = book().getSheetByName(TX);
    const n = sheet.getLastRow() - 1;
    if (n < 1) return;
    const rows = sheet.getRange(2, 1, n, HEADERS.length).getValues();
    const cats = rows.map((r) => {
      const c = learned.get(String(r[C["Merchant key"]]));
      return [c && r[C.Category] === "Uncategorised" ? c : r[C.Category]];
    });
    sheet.getRange(2, C.Category + 1, n, 1).setValues(cats);
  }
  var AI_BATCH = 150;
  var HOUR = 36e5;
  function setAiStatus(text) {
    book().getSheetByName(SETTINGS).getRange(3, 1, 1, 2).setValues([["Gemini categorising", text]]);
  }
  function aiCategorise() {
    var _a, _b;
    const key = PropertiesService.getUserProperties().getProperty("geminiKey");
    if (!key) return 0;
    const props = PropertiesService.getScriptProperties();
    if (Date.now() < Number((_a = props.getProperty("aiRetryAt")) != null ? _a : 0)) return 0;
    const tried = new Set(JSON.parse((_b = props.getProperty("aiTried")) != null ? _b : "[]"));
    const { rows } = loadTransactions();
    const todo = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const k = String(r[C["Merchant key"]]);
      if (todo.size >= AI_BATCH) break;
      if (r[C.Category] !== "Uncategorised" || r[C.Direction] !== "out" || !k || tried.has(k) || todo.has(k)) continue;
      todo.set(k, { id: todo.size, merchant: String(r[C.Merchant]), type: String(r[C.Type]), description: String(r[C.Description]) });
    }
    if (!todo.size) return 0;
    const payload = JSON.stringify(geminiRequest([...todo.values()]));
    let res;
    for (const model of GEMINI_MODELS) {
      res = UrlFetchApp.fetch(geminiUrl(model), {
        method: "post",
        contentType: "application/json",
        headers: { "x-goog-api-key": key },
        payload,
        muteHttpExceptions: true
      });
      if (res.getResponseCode() !== 429 && res.getResponseCode() < 500) break;
    }
    const code = res.getResponseCode();
    if (code !== 200) {
      let why = res.getContentText().slice(0, 200);
      try {
        why = JSON.parse(res.getContentText()).error.message;
      } catch {
      }
      const busy = code === 429 || code >= 500;
      props.setProperty("aiRetryAt", String(Date.now() + (busy ? 15 * 6e4 : HOUR)));
      setAiStatus(`Error ${code}: ${why} (tries again in ${busy ? "15 minutes" : "an hour"})`);
      return 0;
    }
    const answers = parseGeminiReply(res.getContentText());
    const learned = /* @__PURE__ */ new Map();
    for (const [k, p] of todo) {
      tried.add(k);
      const c = answers.get(p.id);
      if (c && c !== "Uncategorised") learned.set(k, c);
    }
    props.setProperty("aiTried", JSON.stringify([...tried].slice(-2e3)));
    saveRules(learned, "Gemini");
    fillCategories(learned);
    setAiStatus(`On. ${Utilities.formatDate(/* @__PURE__ */ new Date(), "Asia/Singapore", "yyyy-MM-dd HH:mm")}: categorised ${learned.size} of ${todo.size} merchants.`);
    return learned.size;
  }
  function setGeminiKey() {
    const ui = SpreadsheetApp.getUi();
    const r = ui.prompt(
      "Categorise with Gemini",
      "Paste a Gemini API key from https://aistudio.google.com/apikey\n\nNames of uncategorised merchants (never amounts, dates or account numbers) are sent to Google's Gemini API. On the free tier Google may use them to improve its products.\n\nThe key is kept in this script's private storage for your account, not in the sheet. Leave blank and press OK to turn this off.",
      ui.ButtonSet.OK_CANCEL
    );
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const key = r.getResponseText().trim();
    ensureSheets();
    if (!key) {
      PropertiesService.getUserProperties().deleteProperty("geminiKey");
      setAiStatus("Off");
      ui.alert("Gemini categorising is off.");
      return;
    }
    PropertiesService.getUserProperties().setProperty("geminiKey", key);
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty("aiRetryAt");
    props.deleteProperty("aiTried");
    const lock = LockService.getScriptLock();
    lock.waitLock(3e4);
    try {
      const n = aiCategorise();
      const status = String(book().getSheetByName(SETTINGS).getRange(3, 2).getValue());
      ui.alert(status.startsWith("Error") ? status : `Done. Gemini categorised ${n} merchants. New ones are categorised as they arrive.`);
    } finally {
      lock.releaseLock();
    }
  }
  function showImport() {
    const html = HtmlService.createHtmlOutputFromFile("Import").setWidth(480).setHeight(320);
    SpreadsheetApp.getUi().showModalDialog(html, "Import statement");
  }
  function importStatement(fileName, lines) {
    const st = parseStatement(lines);
    if (!st) throw new Error(`${fileName}: not an OCBC or DBS/POSB statement I can read.`);
    const lock = LockService.getScriptLock();
    lock.waitLock(3e4);
    try {
      ensureSheets();
      const r = record(st.txns.map((t) => ({ txn: t, key: t.stmtKey, stmtKey: t.stmtKey })), "statement");
      const off = st.accounts.filter((a) => !a.balanced).map((a) => a.account);
      recordBalances(st.accounts.filter((a) => a.balanced));
      aiCategorise();
      buildRecurring();
      return `${fileName}: ${st.txns.length} lines. ${r.added} added, ${r.matched} matched to email alerts, ${r.skipped} already imported. ` + (off.length ? `Warning: totals don't add up for ${off.join(", ")}, so some lines may be missing.` : "Totals check out.");
    } finally {
      lock.releaseLock();
    }
  }
  var ymd = (d) => d instanceof Date ? Utilities.formatDate(d, "Asia/Singapore", "yyyy-MM-dd") : String(d != null ? d : "");
  var ACCOUNT_HEADERS = ["Account", "Balance", "As of", "Estimated now", "Last statement"];
  var PAYLAH_SETTING = "PayLah! payments come out of (an account from the Accounts tab; blank if your wallet holds its own money)";
  var ACCOUNTS_NOTE = "Balance is exact as of its time: from a statement, or typed in with ugotmonee > Update balance. Estimated now adds the email alerts since then, so it misses money that moved without an alert (money coming into OCBC, NETS QR, card payments without card alerts).";
  function balanceFormula(row) {
    const t = `'${TX}'`;
    const since = (dir, acct) => `SUMIFS(${t}!C:C,${t}!G:G,${acct},${t}!E:E,"${dir}",${t}!A:A,">"&C${row})`;
    const paylah = `IF('${SETTINGS}'!$B$4=A${row},${since("out", '"PayLah! Wallet"')},0)`;
    return `=B${row}+${since("in", `A${row}`)}-${since("out", `A${row}`)}-${paylah}`;
  }
  function formatAccounts(sheet) {
    sheet.getRange("C2:C").setNumberFormat("yyyy-mm-dd hh:mm");
    sheet.getRange("E2:E").setNumberFormat("yyyy-mm-dd");
    sheet.getRange("G1").setValue(ACCOUNTS_NOTE);
  }
  function upgradeAccounts() {
    const sheet = book().getSheetByName(ACCOUNTS);
    sheet.getRange(1, 1, 1, ACCOUNT_HEADERS.length).setValues([[...ACCOUNT_HEADERS]]).setFontWeight("bold");
    sheet.getRange("F1").setValue("");
    formatAccounts(sheet);
    const n = sheet.getLastRow() - 1;
    if (n < 1) return;
    sheet.getRange(2, 1, n, 5).getValues().forEach((r, i) => {
      const row = i + 2;
      if (!(r[2] instanceof Date)) return;
      if (!r[4]) {
        const end = /* @__PURE__ */ new Date(`${ymd(r[2])}T23:59:59+08:00`);
        sheet.getRange(row, 3).setValue(end);
        sheet.getRange(row, 5).setValue(end);
      }
      sheet.getRange(row, 4).setFormula(balanceFormula(row));
    });
  }
  function accountNames(sheet) {
    return sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map((r) => String(r[0])) : [];
  }
  function recordBalances(accounts) {
    const sheet = book().getSheetByName(ACCOUNTS);
    formatAccounts(sheet);
    for (const a of accounts) {
      if (!a.asOf) continue;
      const i = accountNames(sheet).indexOf(a.account);
      const row = i >= 0 ? i + 2 : sheet.getLastRow() + 1;
      const end = /* @__PURE__ */ new Date(`${a.asOf}T23:59:59+08:00`);
      const [, , asOf, , lastStatement] = i >= 0 ? sheet.getRange(row, 1, 1, 5).getValues()[0] : [];
      if (!(lastStatement instanceof Date) || lastStatement < end) sheet.getRange(row, 5).setValue(end);
      if (asOf instanceof Date && asOf > end) continue;
      sheet.getRange(row, 1, 1, 3).setValues([[a.account, a.closingCents / 100, end]]);
      sheet.getRange(row, 4).setFormula(balanceFormula(row));
      const settings = book().getSheetByName(SETTINGS);
      if (a.account.startsWith("DBS/POSB") && !settings.getRange(4, 2).getValue()) settings.getRange(4, 2).setValue(a.account);
    }
  }
  function updateBalances() {
    const ui = SpreadsheetApp.getUi();
    ensureSheets();
    const sheet = book().getSheetByName(ACCOUNTS);
    const names = accountNames(sheet);
    if (!names.length) {
      ui.alert("Import a statement first, so the sheet knows your accounts.");
      return;
    }
    formatAccounts(sheet);
    const done = [];
    for (const [i, name] of names.entries()) {
      const r = ui.prompt("Update balance", `${name}

The balance your banking app shows now. Leave blank to skip.`, ui.ButtonSet.OK_CANCEL);
      if (r.getSelectedButton() !== ui.Button.OK) break;
      const text = r.getResponseText().replace(/SGD|S?\$|,|\s/gi, "");
      if (!text) continue;
      const value = Number(text);
      if (!Number.isFinite(value)) {
        ui.alert(`"${r.getResponseText()}" isn't a number, so ${name} wasn't changed.`);
        continue;
      }
      const row = i + 2;
      sheet.getRange(row, 2, 1, 2).setValues([[value, /* @__PURE__ */ new Date()]]);
      sheet.getRange(row, 4).setFormula(balanceFormula(row));
      done.push(name);
    }
    if (done.length) ui.alert(`Updated ${done.join(" and ")}. Alerts from now on are added on top, until a newer statement replaces it.`);
  }
  function remindStatements() {
    ensureSheets();
    const sheet = book().getSheetByName(ACCOUNTS);
    const sgt = new Date(Date.now() + 8 * 36e5);
    const due = new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), 0)).toISOString().slice(0, 10);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues() : [];
    const last = (r) => ymd(r[4] || r[2]);
    const behind = rows.filter((r) => r[0] && last(r) < due).map((r) => `- ${r[0]}: latest statement imported ends ${last(r)}`);
    if (rows.length && !behind.length) return;
    const month = Utilities.formatDate(/* @__PURE__ */ new Date(`${due}T00:00:00+08:00`), "Asia/Singapore", "MMMM yyyy");
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      `ugotmonee: import your ${month} statements`,
      [
        `Your bank statements for ${month} should be ready.`,
        "",
        ...behind.length ? behind : ["- No statements imported yet."],
        "",
        "1. Download the statement PDFs from OCBC and DBS/POSB internet banking.",
        `2. Open your sheet: ${book().getUrl()}`,
        "3. Click ugotmonee > Import statement (PDF) and pick the files.",
        "",
        "If the import says PERMISSION_DENIED, use a private window signed in to just this Google account."
      ].join("\n")
    );
  }
  return __toCommonJS(main_exports);
})();

function onOpen(...args) { return ugotmonee.onOpen(...args); }
function onEdit(...args) { return ugotmonee.onEdit(...args); }
function setup(...args) { return ugotmonee.setup(...args); }
function sync(...args) { return ugotmonee.sync(...args); }
function syncNow(...args) { return ugotmonee.syncNow(...args); }
function showImport(...args) { return ugotmonee.showImport(...args); }
function importStatement(...args) { return ugotmonee.importStatement(...args); }
function remindStatements(...args) { return ugotmonee.remindStatements(...args); }
function setGeminiKey(...args) { return ugotmonee.setGeminiKey(...args); }
function updateBalances(...args) { return ugotmonee.updateBalances(...args); }
function reviewMerchants(...args) { return ugotmonee.reviewMerchants(...args); }
