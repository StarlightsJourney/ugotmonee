const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/\t/g, " ")
    .replace(/&zwnj;|\u200c/g, "")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/^>+ ?/gm, "");
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * "Label: value" lines. Some HTML alerts put the value on the next line
 * ("Date & Time:" then "14 May 11:15 (SGT)"), so a bare label takes the next non-blank line.
 */
export function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let pending: string | null = null;
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

export function parseAmount(raw: string): { amountCents: number; currency: string } | null {
  const m = raw.match(/([A-Z]{3})\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  return { currency: m[1], amountCents: Math.round(parseFloat(m[2].replace(/,/g, "")) * 100) };
}

export function monthIndex(name: string): number | null {
  return MONTHS[name.toLowerCase()] ?? null;
}

/** Banks sometimes write 24h times with a redundant AM/PM, e.g. "16:51 PM", or with a dot, "11.14 AM". */
export function parseTime(raw: string): { h: number; m: number } | null {
  const t = raw.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
  if (!t) return null;
  let h = parseInt(t[1], 10);
  const m = parseInt(t[2], 10);
  const ampm = t[3]?.toUpperCase();
  if (h <= 12 && ampm === "PM" && h !== 12) h += 12;
  if (h === 12 && ampm === "AM") h = 0;
  return { h, m };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toSgtIso(y: number, mo: number, d: number, h = 0, mi = 0): string {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+08:00`;
}

/** Year in Singapore time for a given instant. */
export function sgtYear(date: Date): number {
  return new Date(date.getTime() + 8 * 3600_000).getUTCFullYear();
}

/** For dates without a year: pick the year so the date isn't in the future relative to receipt. */
export function inferYear(mo: number, d: number, receivedAt: Date): number {
  const y = sgtYear(receivedAt);
  const candidate = Date.UTC(y, mo - 1, d) - 8 * 3600_000;
  return candidate > receivedAt.getTime() + 2 * 86400_000 ? y - 1 : y;
}

export function expandYear(y: string): number {
  const n = parseInt(y, 10);
  return y.length === 2 ? 2000 + n : n;
}
