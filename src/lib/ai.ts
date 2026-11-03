// Optional: ask Gemini to categorise merchants the keyword rules didn't know.
// Only the merchant name, payment type and description are sent. No amounts, dates, accounts or references.
import { DEFAULT_CATEGORIES, MONEY_IN } from "./categorise";

/** Tried in order. When one is overloaded, the lighter one usually isn't. */
export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
export const geminiUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Categories Gemini may pick: spending only. Money in and own transfers come from rules, not guesses. */
export const AI_CATEGORIES = DEFAULT_CATEGORIES.filter((c) => c !== "Own transfers" && !MONEY_IN.includes(c));

export interface Payee {
  id: number;
  merchant: string;
  type: string;
  description: string;
}

export function geminiRequest(payees: Payee[]) {
  const prompt = [
    "Categorise these payees from a Singapore bank account. Each one is money going out.",
    "Pick the single best category for each. Anything you can't tell is Uncategorised.",
    "A PayLah! Scan & Pay or NETS QR payment to a person's name is usually a hawker stall or small shop: small amounts there are usually Food & Drinks.",
    "A PayNow transfer to a person's name is Transfers.",
    `Categories: ${AI_CATEGORIES.join(", ")}.`,
    "",
    ...payees.map((p) => JSON.stringify(p)),
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
          required: ["id", "category"],
        },
      },
    },
  };
}

/** Pull id → category out of Gemini's reply, dropping anything outside the list. */
export function parseGeminiReply(body: string): Map<number, string> {
  const out = new Map<number, string>();
  const text = JSON.parse(body)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return out;
  const allowed = new Set<string>(AI_CATEGORIES);
  for (const r of JSON.parse(text)) if (Number.isInteger(r?.id) && allowed.has(r?.category)) out.set(r.id, r.category);
  return out;
}
