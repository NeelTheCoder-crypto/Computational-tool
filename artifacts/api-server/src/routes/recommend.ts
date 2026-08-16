import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { matchCarriers, type CarrierMatch } from "../lib/supabaseQueries.js";
import { GetRecommendationBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/recommend", async (req, res): Promise<void> => {
  const parsed = GetRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nucleic_acid, disease, route_of_administration } = parsed.data;

  const filters = {
    cargoType: nucleic_acid || undefined,
    disease: disease || undefined,
    route: route_of_administration || undefined,
  };

  req.log.info(filters, "Processing recommendation request");

  // Step 1: The authoritative ranked list comes straight from the database filter.
  const matchResult = await matchCarriers(filters, { page: 1, pageSize: 10 });

  req.log.info(
    { total: matchResult.total, top: matchResult.items[0]?.formulation_name },
    "Ranked carriers retrieved for recommendation"
  );

  // Step 2: If there are no matches, return the empty ranked list with no narrative.
  if (matchResult.items.length === 0) {
    res.json({
      filters: matchResult.filters,
      ranked_carriers: [],
      ai_synthesis: null,
    });
    return;
  }

  // Step 3: Feed ONLY the filtered, ranked carriers to the LLM for a secondary narrative.
  const aiSynthesis = await synthesize(
    { nucleic_acid, disease, route_of_administration },
    matchResult.items
  );

  res.json({
    filters: matchResult.filters,
    ranked_carriers: matchResult.items,
    ai_synthesis: aiSynthesis,
  });
});

async function synthesize(
  query: { nucleic_acid: string; disease: string; route_of_administration: string },
  carriers: CarrierMatch[]
): Promise<{
  recommended_carrier: string;
  confidence: "high" | "moderate" | "low";
  scientific_rationale: string;
  key_components: string[];
  advantages: string[];
  limitations: string[];
} | null> {
  const evidence = carriers
    .map((c, i) => {
      const materials = c.materials
        .map((m) => m.canonical_name ?? m.abbreviation)
        .filter(Boolean)
        .join(", ");
      const cargos = c.matched_cargo_types.join(", ");
      const paper = c.paper
        ? `${c.paper.title ?? "Untitled"} (${c.paper.publication_year ?? "n.d."})`
        : "no source paper";
      return (
        `#${i + 1} [formulation_id=${c.formulation_id}] ${c.formulation_name ?? "Unnamed"} ` +
        `(${c.carrier_family ?? "family unknown"}${c.carrier_subtype ? "/" + c.carrier_subtype : ""})\n` +
        `   matched cargo types: ${cargos || "N/A"}; matched routes: ${c.matched_routes.join(", ") || "N/A"}; ` +
        `matched disease models: ${c.matched_disease_models.join(", ") || "N/A"}\n` +
        `   materials: ${materials || "N/A"}\n` +
        `   evidence: ${c.matching_arm_count} matching arms, ${c.supporting_outcome_count} outcomes ` +
        `(${c.favorable_outcome_count} favorable, ${c.adverse_outcome_count} adverse); score=${c.score}\n` +
        `   source: ${paper}`
      );
    })
    .join("\n\n");

  const systemPrompt = `You are a scientific reasoning engine for the NANP Carrier Selection Platform.
You are given a PRE-RANKED list of carrier formulations that the database has already matched and
ranked for the user's query. The ranking is authoritative — do NOT reorder or invent carriers.
Your only job is to write a short narrative that explains why the top-ranked carrier is a good fit,
citing ONLY the carriers, materials, and evidence provided below. Never fabricate anything.

Return raw JSON only (no markdown) with this exact structure:
{
  "recommended_carrier": "string — MUST be the name of the #1 ranked carrier below",
  "confidence": "high" | "moderate" | "low",
  "scientific_rationale": "string — cite the matching arms/outcomes of the top carriers",
  "key_components": ["string array of materials from the top carrier"],
  "advantages": ["string array grounded in the favorable outcomes / evidence provided"],
  "limitations": ["string array — note weak evidence, adverse outcomes, or gaps if present"]
}`;

  const userPrompt = `USER QUERY:
- Nucleic acid / cargo type: ${query.nucleic_acid}
- Target disease: ${query.disease}
- Route of administration: ${query.route_of_administration}

PRE-RANKED CARRIERS (authoritative, top-ranked first):
${evidence}

Write the narrative for the #1 carrier. Return raw JSON only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-terra",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      // Always use the DB top-ranked carrier as the authoritative identifier;
      // the LLM may not echo it back verbatim, so we never trust its string.
      recommended_carrier: carriers[0]?.formulation_name ?? "",
      confidence: ["high", "moderate", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "moderate",
      scientific_rationale:
        typeof parsed.scientific_rationale === "string" ? parsed.scientific_rationale : "",
      key_components: Array.isArray(parsed.key_components) ? parsed.key_components : [],
      advantages: Array.isArray(parsed.advantages) ? parsed.advantages : [],
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
    };
  } catch {
    // AI narrative is secondary; if it fails, the ranked list still stands.
    return null;
  }
}

export default router;
