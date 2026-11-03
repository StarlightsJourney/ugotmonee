// Bundle src/gas into apps-script/, the folder you paste into (or `clasp push` to) Apps Script.
import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("apps-script", { recursive: true });
// The manifest lives in src/gas because `clasp create` overwrites the one in apps-script/.
await copyFile("src/gas/appsscript.json", "apps-script/appsscript.json");

const ENTRY_POINTS = ["onOpen", "onEdit", "setup", "sync", "syncNow", "showImport", "importStatement", "remindStatements", "setGeminiKey", "updateBalances", "reviewMerchants"];

const server = await build({
  entryPoints: ["src/gas/main.ts"],
  bundle: true,
  format: "iife",
  globalName: "ugotmonee",
  target: "es2019",
  write: false,
  legalComments: "none",
});
// Apps Script only sees top-level functions: menus, triggers and google.script.run call these.
const wrappers = ENTRY_POINTS.map((f) => `function ${f}(...args) { return ugotmonee.${f}(...args); }`).join("\n");
const header = "// Built from src/gas by `pnpm build`. Don't edit by hand.\n";
await writeFile("apps-script/Code.js", header + server.outputFiles[0].text + "\n" + wrappers + "\n");

const client = await build({ entryPoints: ["src/gas/import-client.ts"], bundle: true, format: "iife", target: "es2019", write: false, minify: true });
const html = await readFile("src/gas/import.html", "utf8");
await writeFile("apps-script/Import.html", html.replace("/*CLIENT*/", () => client.outputFiles[0].text.trim()));

console.log("built apps-script/");
