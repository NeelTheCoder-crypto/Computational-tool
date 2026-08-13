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
  type FormulationRecord,
  type MaterialRecord,
  type OutcomeRecord,
  type MechanismRecord,
  type LimitationRecord,
  type PaperRecord,
  type PhysicochemicalRecord,
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

  // Step 1: Retrieve formulations matching the nucleic acid cargo type
  const formulations = await getFormulations(nucleic_acid);

  const formulationIds = formulations.map((f) => f.id);
  const paperIds = [...new Set(formulations.map((f) => f.paper_id).filter(Boolean) as string[])];

  req.log.info(
    { formulations: formulations.length, paperIds: paperIds.length },
    "Formulations retrieved"
  );

  // Step 2: Retrieve all related evidence in parallel, scoped to matched formulations
  const [materials, outcomes, mechanisms, limitations, papers, measurements] =
    await Promise.all([
      getMaterials(formulationIds),
      getOutcomes(formulationIds),
      getMechanisms(formulationIds),
      getLimitations(formulationIds),
      getSupportingPapers(paperIds),
      getPhysicochemicalMeasurements(formulationIds),
    ]);

  req.log.info(
    {
      formulations: formulations.length,
      materials: materials.length,
      outcomes: outcomes.length,
      mechanisms: mechanisms.length,
      limitations: limitations.length,
      papers: papers.length,
      measurements: measurements.length,
    },
    "Evidence retrieved from database"
  );

  // Step 3: Build evidence context for the LLM
  const evidenceContext = buildEvidenceContext({
    formulations,
    materials,
    outcomes,
    mechanisms,
    limitations,
    papers,
    measurements,
  });

  // Step 4: Call OpenAI — LLM reasons over retrieved evidence, never invents
  const systemPrompt = `You are a scientific reasoning engine for the NANP Carrier Selection Platform.
Your role is to analyze retrieved scientific database records and synthesize a carrier recommendation.

CRITICAL RULES:
1. You MUST base ALL recommendations EXCLUSIVELY on the retrieved database records provided below.
2. You MUST NEVER invent, fabricate, or extrapolate formulations, materials, or scientific claims not present in the database.
3. Every claim must be traceable to the retrieved evidence.
4. If the database contains insufficient evidence for a confident recommendation, lower the confidence score accordingly — but still recommend the best-supported option from the data.
5. Cite specific papers from the Supporting Papers section by their title.

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
      "paper_id": "string or null",
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
- Target disease / disease model: ${disease}
- Route of administration: ${route_of_administration}

RETRIEVED DATABASE EVIDENCE:
${evidenceContext}

Based ONLY on the above retrieved records, synthesize the best carrier recommendation. Return raw JSON only.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";

  let recommendation;
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    recommendation = JSON.parse(cleaned);
  } catch {
    req.log.error({ rawContent }, "Failed to parse LLM response as JSON");
    res.status(500).json({ error: "Failed to parse recommendation from AI model" });
    return;
  }

  req.log.info(
    { recommended_carrier: recommendation.recommended_carrier },
    "Recommendation generated"
  );

  res.json(recommendation);
});

function buildEvidenceContext(evidence: {
  formulations: FormulationRecord[];
  materials: MaterialRecord[];
  outcomes: OutcomeRecord[];
  mechanisms: MechanismRecord[];
  limitations: LimitationRecord[];
  papers: PaperRecord[];
  measurements: PhysicochemicalRecord[];
}): string {
  const sections: string[] = [];

  if (evidence.formulations.length > 0) {
    sections.push("=== FORMULATIONS ===");
    for (const f of evidence.formulations) {
      sections.push(
        `[${f.name ?? "Unnamed"}] ${f.carrier_family ?? ""}${f.carrier_subtype ? " / " + f.carrier_subtype : ""}\n` +
          `  Route: ${f.intended_route ?? "N/A"}\n` +
          `  Description: ${f.description ?? "N/A"}\n` +
          `  Cargo types: ${f.cargo_types.join(", ") || "N/A"}\n` +
          `  Materials: ${f.material_names.join(", ") || "N/A"}\n` +
          `  Targeting: ${f.targeting_strategies.join(", ") || "N/A"}\n` +
          `  Processes: ${f.processes.join(", ") || "N/A"}`
      );
    }
  }

  if (evidence.materials.length > 0) {
    sections.push("\n=== MATERIALS ===");
    for (const m of evidence.materials) {
      sections.push(
        `${m.name ?? "Unnamed"} (${m.material_class ?? "unknown class"})${m.notes ? ": " + m.notes : ""}`
      );
    }
  }

  if (evidence.outcomes.length > 0) {
    sections.push("\n=== BIOLOGICAL OUTCOMES ===");
    for (const o of evidence.outcomes) {
      const val = o.value_numeric != null ? `${o.value_numeric} ${o.unit ?? ""}` : (o.value_text ?? "N/A");
      sections.push(
        `[${o.formulation_name ?? "unknown formulation"}] ${o.outcome_domain ?? ""} / ${o.metric_code ?? "outcome"}: ` +
          `${val} | direction: ${o.direction ?? "N/A"} | ${o.interpretation ?? ""}`
      );
    }
  }

  if (evidence.measurements.length > 0) {
    sections.push("\n=== PHYSICOCHEMICAL MEASUREMENTS ===");
    for (const p of evidence.measurements) {
      const val = p.value_numeric != null ? `${p.value_numeric} ${p.unit ?? ""}` : (p.value_text ?? "N/A");
      sections.push(
        `[${p.formulation_name ?? "unknown"}] ${p.metric_code ?? "measurement"}${p.condition_code ? " (" + p.condition_code + ")" : ""}: ${val}`
      );
    }
  }

  if (evidence.mechanisms.length > 0) {
    sections.push("\n=== DELIVERY MECHANISMS ===");
    for (const m of evidence.mechanisms) {
      sections.push(
        `[${m.formulation_name ?? "unknown"}] ${m.category ?? "mechanism"}: ${m.statement ?? "N/A"}`
      );
    }
  }

  if (evidence.limitations.length > 0) {
    sections.push("\n=== KNOWN LIMITATIONS ===");
    for (const l of evidence.limitations) {
      sections.push(
        `[${l.formulation_name ?? "unknown"}] ${l.category ?? "limitation"}: ${l.statement ?? "N/A"}`
      );
    }
  }

  if (evidence.papers.length > 0) {
    sections.push("\n=== SUPPORTING PAPERS ===");
    for (const p of evidence.papers) {
      sections.push(
        `"${p.title ?? "Untitled"}" — ${p.authors ?? "Authors unknown"}\n` +
          `  Journal: ${p.journal ?? "N/A"}, Year: ${p.year ?? "N/A"}, DOI: ${p.doi ?? "N/A"}`
      );
    }
  }

  return sections.length > 0
    ? sections.join("\n")
    : "No matching records found in the database for this query.";
}

export default router;
