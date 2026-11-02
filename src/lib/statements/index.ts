import { parseDbsStatement } from "./dbs";
import { parseOcbcStatement } from "./ocbc";

export * from "./types";
export { itemsToLines, type TextItem } from "./lines";

/** Lines of text from a statement PDF -> transactions, or null if no parser recognises it. */
export function parseStatement(lines: string[]) {
  return parseOcbcStatement(lines) ?? parseDbsStatement(lines);
}
