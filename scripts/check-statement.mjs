// Run a statement PDF through the same code the import dialog uses and print
// whether the totals add up. Prints no transactions unless you pass --show.
//   pnpm check-statement ~/Downloads/statement.pdf [--show] [--lines]
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// pdf.js warns that it can't draw without the optional canvas package. We only read text.
const quiet = console.log;
console.log = () => {};
const { default: pdfjs } = await import("pdfjs-dist/legacy/build/pdf.js");
console.log = quiet;

const show = process.argv.includes("--show");
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: pnpm check-statement <file.pdf>... [--show]");
  process.exit(1);
}

const out = join(tmpdir(), `ugotmonee-statements-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/statements/index.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error" });
const { itemsToLines, parseStatement } = await import(pathToFileURL(out).href);
await rm(out);

const money = (c) => (c / 100).toFixed(2);
let failed = false;

for (const file of files) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 }).promise;
  const lines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const { items } = await (await pdf.getPage(i)).getTextContent();
    lines.push(...itemsToLines(items.filter((it) => "str" in it).map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }))));
  }
  if (process.argv.includes("--lines")) console.log(lines.join("\n"));
  const st = parseStatement(lines);
  console.log(`\n${file}`);
  if (!st) {
    console.log("  not recognised as an OCBC or DBS/POSB statement");
    failed = true;
    continue;
  }
  const kinds = {};
  for (const t of st.txns) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
  console.log(`  ${st.bank}: ${st.txns.length} transactions ${JSON.stringify(kinds)}`);
  for (const a of st.accounts) {
    console.log(
      `  ${a.balanced ? "OK  " : "FAIL"} opening ${money(a.openingCents)} - out ${money(a.debitCents)} + in ${money(a.creditCents)} = ${money(a.openingCents - a.debitCents + a.creditCents)}, statement says ${money(a.closingCents)} as of ${a.asOf}`,
    );
    failed ||= !a.balanced;
  }
  const keys = new Set(st.txns.map((t) => t.stmtKey));
  if (keys.size !== st.txns.length) {
    console.log(`  FAIL ${st.txns.length - keys.size} duplicate statement keys`);
    failed = true;
  }
  if (show) for (const t of st.txns) console.log(`  ${t.occurredAt.slice(0, 10)} ${t.direction === "debit" ? "-" : "+"}${money(t.amountCents).padStart(9)}  ${t.kind.padEnd(8)} ${t.payeeType.padEnd(8)} ${t.merchant}`);
}
process.exit(failed ? 1 : 0);
