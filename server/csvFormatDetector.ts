/**
 * AI-powered CSV format detector for PocketPulse.
 *
 * When the heuristic parser in csvParser.ts cannot identify the column layout
 * of a bank's CSV export, this module sends the header row + a handful of
 * sample data rows to GPT-4o-mini and asks it to identify the column roles.
 *
 * Only structural information (column headers + a few sample cell values) is
 * sent — no bulk transaction data leaves the server.  The returned spec is
 * cached in the `csv_format_specs` table so repeat uploads from the same bank
 * format never incur a second AI call.
 *
 * Returns null on any failure so callers can fall back gracefully.
 */
import OpenAI from "openai";
import type { CsvFormatSpec } from "../shared/schema.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a CSV format analyzer for a financial transaction parser.

Given the first few rows of a bank CSV export, identify the column structure.

Return ONLY a JSON object with this exact shape (no extra keys):
{
  "preambleRows": <number of rows before the header row; 0 if header is first>,
  "hasHeader": <true if there is a named header row, false for headerless/positional formats>,
  "dateColumn": <0-based column index of the transaction date>,
  "descriptionColumn": <0-based column index of the merchant/description>,
  "amountColumn": <0-based column index of a combined amount column, or null>,
  "debitColumn": <0-based column index of a debit/withdrawal column, or null>,
  "creditColumn": <0-based column index of a credit/deposit column, or null>,
  "typeColumn": <0-based column index of a transaction-type/DR-CR column, or null>,
  "signConvention": <"signed" if negative=outflow or "unsigned" if all amounts positive>
}

Rules:
- amountColumn and debit/creditColumn are mutually exclusive: if the bank uses
  separate Debit and Credit columns, set amountColumn=null and debitColumn/creditColumn
  to the correct indices.
- If the bank uses a single Amount column with negative values for outflows,
  set amountColumn to its index and set signConvention="signed".
- If the bank uses a single Amount column where all values are positive (unsigned),
  set signConvention="unsigned".
- preambleRows counts rows before the header row (0 if the first row is the header).
  For headerless files, preambleRows=0 and hasHeader=false.
- Return only valid JSON with no markdown fences, no commentary.`;

type RawSpec = {
  preambleRows: unknown;
  hasHeader: unknown;
  dateColumn: unknown;
  descriptionColumn: unknown;
  amountColumn: unknown;
  debitColumn: unknown;
  creditColumn: unknown;
  typeColumn: unknown;
  signConvention: unknown;
};

function isValidSpec(raw: RawSpec): raw is {
  preambleRows: number;
  hasHeader: boolean;
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  typeColumn: number | null;
  signConvention: "signed" | "unsigned";
} {
  if (typeof raw.preambleRows !== "number" || raw.preambleRows < 0) return false;
  if (typeof raw.hasHeader !== "boolean") return false;
  if (typeof raw.dateColumn !== "number" || raw.dateColumn < 0) return false;
  if (typeof raw.descriptionColumn !== "number" || raw.descriptionColumn < 0) return false;
  if (raw.amountColumn !== null && typeof raw.amountColumn !== "number") return false;
  if (raw.debitColumn !== null && typeof raw.debitColumn !== "number") return false;
  if (raw.creditColumn !== null && typeof raw.creditColumn !== "number") return false;
  if (raw.typeColumn !== null && typeof raw.typeColumn !== "number") return false;
  if (raw.signConvention !== "signed" && raw.signConvention !== "unsigned") return false;
  // Must have either amountColumn or at least one of debit/creditColumn
  if (raw.amountColumn === null && raw.debitColumn === null && raw.creditColumn === null) return false;
  return true;
}

/**
 * Build a compact representation of the rows to send to the AI.
 * Sends column values as-is (needed to detect date format, numeric columns, etc.)
 * but keeps the payload small by limiting to MAX_SAMPLE_ROWS data rows.
 */
function buildSampleText(rawRows: string[][]): string {
  return rawRows
    .map((row, i) => `[row ${i}]: ${row.map((cell) => JSON.stringify(cell)).join(", ")}`)
    .join("\n");
}

/**
 * Ask GPT-4o-mini to identify the column layout of a CSV.
 *
 * @param allRows  The first N raw parsed rows (header + preamble + a few data rows).
 *                 These should already be split into cells (as from csv-parse).
 * @returns        A validated CsvFormatSpec, or null on failure.
 */
export async function detectCsvFormat(
  allRows: string[][],
): Promise<CsvFormatSpec | null> {
  const client = getClient();
  if (!client) return null;
  if (allRows.length === 0) return null;

  const MAX_SAMPLE_ROWS = 12; // header/preamble + at most ~5 data rows
  const sampleRows = allRows.slice(0, MAX_SAMPLE_ROWS);
  const sampleText = buildSampleText(sampleRows);

  let raw: string | null = null;
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Identify the column layout from these CSV rows:\n\n${sampleText}`,
        },
      ],
    });
    raw = response.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.warn(
      `[csvFormatDetector] OpenAI call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[csvFormatDetector] Could not parse AI response as JSON: ${raw.slice(0, 200)}`);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as RawSpec;
  if (!isValidSpec(candidate)) {
    console.warn(
      `[csvFormatDetector] AI response failed validation: ${JSON.stringify(candidate).slice(0, 300)}`,
    );
    return null;
  }

  const spec: CsvFormatSpec = {
    preambleRows: candidate.preambleRows,
    hasHeader: candidate.hasHeader,
    dateColumn: candidate.dateColumn,
    descriptionColumn: candidate.descriptionColumn,
    amountColumn: candidate.amountColumn,
    debitColumn: candidate.debitColumn,
    creditColumn: candidate.creditColumn,
    typeColumn: candidate.typeColumn,
    signConvention: candidate.signConvention,
  };

  console.log(`[csvFormatDetector] AI spec detected: ${JSON.stringify(spec)}`);
  return spec;
}
