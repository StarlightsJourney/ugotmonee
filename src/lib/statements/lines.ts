/** A piece of text pdf.js found on a page, with its position in PDF points. */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Points per character column. Only relative positions matter to the parsers. */
const CW = 4;

/**
 * Rebuild a page's text as lines, keeping columns roughly where they were
 * (like `pdftotext -layout`), so parsers can tell description lines from
 * page furniture by indentation.
 */
export function itemsToLines(items: TextItem[]): string[] {
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
    if (!row) rows.push((row = { y: it.y, items: [] }));
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);

  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let line = "";
    let end = -Infinity;
    for (const it of r.items) {
      const gap = it.x - end;
      if (gap > CW * 0.3) {
        const pad = Math.max(Math.round(it.x / CW) - line.length, gap > CW * 1.5 ? 2 : 1);
        line += " ".repeat(pad);
      }
      line += it.str;
      end = it.x + it.width;
    }
    return line.trimEnd();
  });
}
