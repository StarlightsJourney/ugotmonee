// Runs in the import dialog, in the user's browser. The PDF is read here;
// only the text lines are passed to the script, and only transactions are saved.
import { itemsToLines } from "../lib/statements/lines";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const pdfjsLib: any;
declare const google: any;

function log(message: string, error = false) {
  const div = document.createElement("div");
  div.textContent = message;
  if (error) div.className = "err";
  document.getElementById("log")!.appendChild(div);
}

async function readPdf(file: File): Promise<string[]> {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  task.onPassword = (answer: (pw: string) => void) => {
    const pw = prompt(`${file.name} has a password. Enter it to read the file (it isn't saved):`);
    if (pw === null) task.destroy();
    else answer(pw);
  };
  const pdf = await task.promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const { items } = await (await pdf.getPage(i)).getTextContent();
    lines.push(
      ...itemsToLines(items.filter((it: any) => "str" in it).map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }))),
    );
  }
  return lines;
}

function save(name: string, lines: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).importStatement(name, lines),
  );
}

document.getElementById("files")!.addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  for (const file of Array.from(input.files ?? [])) {
    log(`Reading ${file.name}…`);
    try {
      log(await save(file.name, await readPdf(file)));
    } catch (e: any) {
      log(e?.message ?? String(e), true);
    }
  }
  input.value = "";
});
