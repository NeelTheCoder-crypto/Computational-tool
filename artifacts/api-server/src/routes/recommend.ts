import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getFormulations,
  getMaterials,
  getOutcomes,
  getMechanisms,
  getLimitations,
  getSupportingPapers,
  getPhysicochemicalMeasurements,
} from "../lib/supabaseQueries.js";
import { GetRecommendationBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/recommend", async (req, res): Promise<void> => {
  const parsed = GetRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nucleic_acid, disease, route_of_administration } = parsed.data;

  req.log.info(
    { nucleic_acid, disease, route_of_administration },
    "Processing recommendation request"
  );

  // Step 1: Retrieve all relevant evidence from Supabase
  const [
    formulations,
    materials,
    outcomes,
    mechanisms,
    limitations,
    papers,
    measurements,
  ] = await Promise.all([
    getFormulations(),
    getMaterials(),
    getOutcomes(),
    getMechanisms(),
    getLimitations(),
    getSupportingPapers(),
    getPhysicochemicalMeasurements(),
  ]);

  req.log.info(
    {
      formulations: formulations.length,
      papers: papers.length,
      outcomes: outcomes.length,
    },
    "Evidence retrieved from database"
  );

  // Step 2: Build evidence context for the LLM
  const evidenceContext = buildEvidenceContext({
    formulations,
    materials,
    outcomes,
    mechanisms,
    limitations,
    papers,
    measurements,
  });

  // Step 3: Call OpenAI with structured evidence — LLM only reasons, never invents
  const systemPrompt = `You are a scientific reasoning engine for the NANP Carrier Selection Platform.
Your role is to analyze retrieved scientific database records and synthesize a carrier recommendation.

CRITICAL RULES:
1. You MUST base ALL recommendations EXCLUSIVELY on the retrieved database records provided below.
2. You MUST NEVER invent, fabricate, or extrapolate formulations, materials, or scientific claims not present in the database.
3. Every claim must be traceable to the retrieved evidence.
4. If the database contains insufficient evidence for a confident recommendation, lower the confidence score accordingly.
5. Cite specific papers from the Supporting Papers section by their ID and title.

You will return a JSON object (no markdown, raw JSON only) with this exact structure:
{
  "recommended_carrier": "string — name of the top recommended formulation from the database",
  "confidence": "high" | "moderate" | "low",
  "scientific_rationale": "string — detailed scientific explanation citing retrieved evidence",
  "key_components": ["string array of material components from the database"],
  "advantages": ["string array of advantages supported by retrieved outcomes/mechanisms"],
  "limitations": ["string array of limitations from the database records"],
  "supporting_mechanisms": ["string array of delivery mechanisms from the database"],
  "supporting_publications": [
    {
      "paper_id": number or null,
      "title": "string",
      "authors": "string or null",
      "journal": "string or null",
      "year": number or null,
      "doi": "string or null",
      "relevance": "string — how this paper supports the recommendation"
    }
  ],
  "alternative_formulations": [
    {
      "name": "string — formulation name from the database",
      "materials": ["string array"],
      "rationale": "string — why this is a viable alternative based on retrieved data"
    }
  ]
}`;

  const userPrompt = `USER REQUEST:
- Therapeutic nucleic acid: ${nucleic_acid}
- Target disease: ${disease}
- Route of administration: ${route_of_administration}

RETRIEVED DATABASE EVIDENCE:
${evidenceContext}

Based ONLY on the above retrieved records, synthesize a carrier recommendation. Return raw JSON only.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  // Parse the JSON response from the LLM
  let recommendation;
  try {
    // Strip any accidental markdown code fences
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    recommendation = JSON.parse(cleaned);
  } catch {
    req.log.error({ rawContent }, "Failed to parse LLM response as JSON");
    res.status(500).json({
      error: "Failed to parse recommendation from AI model",
    });
    return;
  }

  req.log.info(
    { recommended_carrier: recommendation.recommended_carrier },
    "Recommendation generated"
  );

  res.json(recommendation);
});

function buildEvidenceContext(evidence: {
  formulations: ReturnType<typeof getFormulations> extends Promise<infer T>
    ? T
    : never;
  materials: ReturnType<typeof getMaterials> extends Promise<infer T>
    ? T
    : never;
  outcomes: ReturnType<typeof getOutcomes> extends Promise<infer T>
    ? T
    : never;
  mechanisms: ReturnType<typeof getMechanisms> extends Promise<infer T>
    ? T
    : never;
  limitations: ReturnType<typeof getLimitations> extends Promise<infer T>
    ? T
    : never;
  papers: ReturnType<typeof getSupportingPapers> extends Promise<infer T>
    ? T
    : never;
  measurements: ReturnType<
    typeof getPhysicochemicalMeasurements
  > extends Promise<infer T>
    ? T
    : never;
}): string {
  const sections: string[] = [];

  // Formulations
  if (evidence.formulations.length > 0) {
    sections.push("=== FORMULATIONS ===");
    for (const f of evidence.formulations.slice(0, 50)) {
      sections.push(
        `[ID:${f.id}] ${f.name ?? "Unnamed"} (${f.formulation_type ?? "type unknown"})\n` +
          `  Description: ${f.description ?? "N/A"}\n` +
          `  Cargo types: ${f.cargo_types.join(", ") || "N/A"}\n` +
          `  Materials: ${f.material_names.join(", ") || "N/A"}\n` +
          `  Targeting: ${f.targeting_strategies.join(", ") || "N/A"}\n` +
          `  Processes: ${f.processes.join(", ") || "N/A"}`
      );
    }
  }

  // Materials
  if (evidence.materials.length > 0) {
    sections.push("\n=== MATERIALS ===");
    for (const m of evidence.materials.slice(0, 80)) {
      sections.push(
        `[ID:${m.id}] ${m.name ?? "Unnamed"} (${m.material_type ?? "unknown type"}): ${m.description ?? "N/A"}`
      );
    }
  }

  // Biological outcomes
  if (evidence.outcomes.length > 0) {
    sections.push("\n=== BIOLOGICAL OUTCOMES ===");
    for (const o of evidence.outcomes.slice(0, 80)) {
      sections.push(
        `[Formulation: ${o.formulation_name ?? "unknown"}] ${o.outcome_type ?? "outcome"}: ` +
          `${o.metric_name ?? ""} = ${o.outcome_value ?? "N/A"} ${o.outcome_unit ?? ""} ` +
          `(model: ${o.in_vivo_model ?? o.cell_line ?? o.tissue_type ?? "N/A"}) ` +
          `${o.notes ? "Notes: " + o.notes : ""}`
      );
    }
  }

  // Physicochemical measurements
  if (evidence.measurements.length > 0) {
    sections.push("\n=== PHYSICOCHEMICAL MEASUREMENTS ===");
    for (const p of evidence.measurements.slice(0, 60)) {
      sections.push(
        `[Formulation: ${p.formulation_name ?? "unknown"}] ${p.measurement_type ?? "measurement"}: ${p.value ?? "N/A"} ${p.unit ?? ""}`
      );
    }
  }

  // Mechanisms
  if (evidence.mechanisms.length > 0) {
    sections.push("\n=== DELIVERY MECHANISMS ===");
    for (const m of evidence.mechanisms) {
      sections.push(
        `[Formulation: ${m.formulation_name ?? "unknown"}] ${m.mechanism_type ?? "mechanism"}: ${m.description ?? "N/A"}`
      );
    }
  }

  // Limitations
  if (evidence.limitations.length > 0) {
    sections.push("\n=== KNOWN LIMITATIONS ===");
    for (const l of evidence.limitations) {
      sections.push(
        `[Formulation: ${l.formulation_name ?? "unknown"}] ${l.limitation_type ?? "limitation"}: ${l.description ?? "N/A"}`
      );
    }
  }

  // Papers
  if (evidence.papers.length > 0) {
    sections.push("\n=== SUPPORTING PAPERS ===");
    for (const p of evidence.papers) {
      sections.push(
        `[ID:${p.id}] "${p.title ?? "Untitled"}" — ${p.authors ?? "Authors unknown"}\n` +
          `  Journal: ${p.journal ?? "N/A"}, Year: ${p.year ?? "N/A"}, DOI: ${p.doi ?? "N/A"}\n` +
          `  Abstract: ${p.abstract ? p.abstract.substring(0, 300) + "..." : "N/A"}`
      );
    }
  }

  return sections.join("\n");
}

export default router;
