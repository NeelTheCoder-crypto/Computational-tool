/**
 * The public Google Sheet is the only scientific data source for this app.
 * Tags are literal, conservative matches in row text, not inferred suitability.
 */
export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Z1Ua5BqBYKhvfDn1hxSMK1NjrZq2bjkhcEQTbEih9YQ/edit";
const EXPORT_URL =
  "https://docs.google.com/spreadsheets/d/1Z1Ua5BqBYKhvfDn1hxSMK1NjrZq2bjkhcEQTbEih9YQ/export?format=csv&gid=0";
const TTL_MS = 5 * 60 * 1000;

export interface SheetRecord {
  row: number;
  particle_type: string;
  reference: string;
  composition: string;
  mechanism: string;
  advantages: string;
  limitations: string;
  methodology: string;
  formulation_name: string | null;
  diseases: string[];
  routes: string[];
  cargos: string[];
  is_review: boolean;
  source_url: string;
}

export interface SheetCatalog {
  records: SheetRecord[];
  options: { diseases: string[]; routes: string[]; cargos: string[] };
  updated_at: string;
  sheet_url: string;
}

// Only explicitly named conditions. No disease is inferred from target organ.
const diseases: [string, RegExp][] = [
  ["Cystic fibrosis", /\bcystic fibrosis\b/i],
  ["Idiopathic pulmonary fibrosis", /\bidiopathic pulmonary fibrosis\b/i],
  ["Pulmonary fibrosis", /\bpulmonary fibrosis\b/i],
  ["Autoimmune pulmonary alveolar proteinosis", /\bautoimmune pulmonary alveolar proteinosis\b|\baPAP\b/i],
  ["Lung cancer", /\blung cancer\b|\bpulmonary (?:tumou?r|carcinoma)\b/i],
  ["Asthma", /\basthma\b/i],
  ["Lung infection", /\blung infection\b|\bpulmonary infection\b/i],
  ["Influenza", /\binfluenza\b/i],
  ["COVID-19", /\bCOVID-19\b|\bSARS-CoV-2\b/i],
  ["Alzheimer's disease", /\bAlzheimer'?s disease\b/i],
];
const routes: [string, RegExp][] = [
  ["Inhalation", /\binhal(?:ation|ed|able)\b|\bnebuliz(?:ation|ed|er)\b|\bnebulis(?:ation|ed|er)\b/i],
  ["Intranasal", /\bintranasal\b|\bnasal (?:administration|delivery|route)\b/i],
  ["Intratracheal", /\bintratracheal\b/i],
  ["Intravenous", /\bintravenous\b|\bIV injection\b/i],
  ["Oral", /\boral (?:administration|delivery|dosing|route)\b/i],
  ["Systemic", /\bsystemic (?:administration|delivery|injection|route)\b/i],
];
const cargos: [string, RegExp][] = [
  ["mRNA", /\bmRNA\b/i],
  ["siRNA", /\bsiRNA\b/i],
  ["miRNA", /\bmiRNA\b|\bmicroRNA\b/i],
  ["Aptamer", /\baptamers?\b/i],
  ["NANP", /\bNANPs?\b|\bnucleic acid nanoparticles?\b/i],
  ["Plasmid DNA", /\bplasmid(?:\s+DNA)?\b|\bpDNA\b/i],
  ["DNA", /\bDNA\b/i],
];

// RFC 4180 quoting including multiline cells and escaped double quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Sheet CSV has an unterminated quoted field");
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

function namedMatches(source: string, rules: [string, RegExp][]): string[] {
  return rules.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

function nameFromComposition(text: string): string | null {
  const match = text.match(
    /(?:optimized(?:\/final|\/lung)? carrier|optimized\/final formulation|optimized formulation|final carrier|final formulation):\s*([^\n;]{3,90})/i
  );
  if (!match) return null;
  const candidate = (match[1] ?? "")
    .trim()
    .replace(/^(?:the|an?)\s+/i, "")
    .split(/\.\s+(?=[A-Z-])|(?:\.\s*)?-\s+(?=[A-Z])/)[0]
    ?.replace(/\.$/, "")
    .trim() ?? "";
  // Some rows describe only ingredients after the label, not a product name.
  if (/^(?:not reported|ionizable lipid|lipids?[: ,]|polymer blend|formulation contains)/i.test(candidate))
    return null;
  return candidate || null;
}

export function parseSheet(text: string, updatedAt = new Date().toISOString()): SheetCatalog {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map((s) => s.trim().replace(/:$/, "").toLowerCase());
  if (
    !header ||
    ["particle type", "refrence", "composition", "mechanism", "advantages", "limitations", "methodology"]
      .some((value, index) => header[index] !== value)
  ) {
    throw new Error("Sheet columns have changed; the expected seven-column carrier table was not found");
  }
  const records: SheetRecord[] = rows.flatMap((cells, index) => {
    if (cells.every((cell) => !cell.trim())) return [];
    const [particle_type, reference, composition, mechanism, advantages, limitations, methodology] =
      Array.from({ length: 7 }, (_, i) => (cells[i] ?? "").trim());
    const row = index + 2;
    // Missing fields are presented as missing, never silently substituted.
    const tagText = [reference, composition, mechanism, advantages, methodology].join(" ");
    const diseaseText = [reference, advantages].join(" ");
    const foundDiseases = namedMatches(diseaseText, diseases);
    const distinctDiseases = foundDiseases.includes("Idiopathic pulmonary fibrosis")
      ? foundDiseases.filter((name) => name !== "Pulmonary fibrosis")
      : foundDiseases;
    return [{
      row, particle_type, reference, composition, mechanism, advantages, limitations,
      methodology, formulation_name: nameFromComposition(composition),
      diseases: distinctDiseases,
      routes: namedMatches(tagText, routes),
      cargos: namedMatches([reference, composition, advantages, methodology].join(" "), cargos),
      is_review: /\breview\b|\brecent advances\b|\boverview\b|\bupdate on\b/i.test(reference) ||
        /^review article/i.test(particle_type),
      source_url: `${SHEET_URL}#range=A${row}:G${row}`,
    }];
  });
  if (records.length === 0) throw new Error("The carrier sheet has no readable records");
  const distinct = (key: "diseases" | "routes" | "cargos") =>
    [...new Set(records.flatMap((record) => record[key]))].sort((a, b) => a.localeCompare(b));
  return {
    records,
    options: { diseases: distinct("diseases"), routes: distinct("routes"), cargos: distinct("cargos") },
    updated_at: updatedAt,
    sheet_url: SHEET_URL,
  };
}

let cache: { value: SheetCatalog; expires: number } | null = null;
let pending: Promise<SheetCatalog> | null = null;

export async function getSheetCatalog(): Promise<SheetCatalog> {
  if (cache && Date.now() < cache.expires) return cache.value;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(EXPORT_URL, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Google Sheet export returned HTTP ${response.status}`);
    const text = await response.text();
    const catalog = parseSheet(text);
    cache = { value: catalog, expires: Date.now() + TTL_MS };
    return catalog;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}