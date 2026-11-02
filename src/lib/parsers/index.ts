import { parseDbs } from "./dbs";
import { parseOcbc } from "./ocbc";
import type { ParseResult, RawEmail } from "./types";
import { normaliseText } from "./util";

export * from "./types";

const PARSERS = [parseOcbc, parseDbs];

export function parseEmail(email: RawEmail): ParseResult {
  const text = normaliseText(email.text);
  for (const parser of PARSERS) {
    const result = parser(email, text);
    if (result) return result;
  }
  return { status: "unrecognised" };
}
