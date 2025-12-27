import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { LearningIndexResponse, EnrichedModulesResponse } from "@/types/learning";

const ENRICH_PROMPT_TEMPLATE = `Act as an expert academic researcher and librarian.

I will provide you with a "Learning Index" in JSON format, containing a list of learning modules/topics.
Your task is to curate **2 high-quality external resources** (articles, research papers, or authoritative documentation) for EACH module in the list to help the user study that specific concept.

**Instructions:**

1.  **Process:** Iterate through every item in the provided \`learning_modules\` list.
2.  **Selection Criteria:**
    *   Select resources that are highly relevant, credible, and educational.
    *   Prioritize open-access papers (arXiv), reputable tech blogs (like Mozilla MDN, Vercel Blog, Medium curated), or recognized academic journals.
3.  **Formatting:**
    *   **Title:** The exact title of the article or paper.
    *   **Description:** A concise, one-line summary of why this resource is valuable for this specific topic.
    *   **URL:** A direct link to the resource.
4.  **Output:** Return the result STRICTLY as a valid JSON object. Do not use Markdown formatting (no \`\`\`json).

**JSON Output Schema:**
{
  "enriched_modules": [
    {
      "module_title": "The exact title from the input module",
      "resources": [
        {
          "title": "Title of Reference 1",
          "description": "One-line summary of the content.",
          "url": "https://..."
        },
        {
          "title": "Title of Reference 2",
          "description": "One-line summary of the content.",
          "url": "https://..."
        }
      ]
    }
    // ... repeat for all modules
  ]
}

**Input JSON:**
"""
{{JSON_INDEX_INPUT}}
"""`;

function cleanJsonResponse(text: string): string {
  // Remove markdown code blocks if present
  let cleaned = text.trim();
  
  // Remove ```json or ``` at the start
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  
  // Remove ``` at the end
  cleaned = cleaned.replace(/\s*```$/g, "");
  
  // Try to extract JSON if there's extra text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { 
        error: "Server configuration error: OPENAI_API_KEY not set",
        details: "Please ensure OPENAI_API_KEY is configured in Vercel environment variables and redeploy."
      },
      { status: 500 }
    );
  }

  try {
    const learningIndex: LearningIndexResponse = await request.json();

    if (!learningIndex || !learningIndex.learning_modules || !Array.isArray(learningIndex.learning_modules)) {
      return NextResponse.json(
        { error: "Invalid Learning Index format" },
        { status: 400 }
      );
    }

    console.log("[Enrich API] Processing enrichment request, modules count:", learningIndex.learning_modules.length);

    // Initialize OpenAI
    const openai = new OpenAI({ apiKey });

    // Build prompt with JSON input
    const jsonInput = JSON.stringify(learningIndex, null, 2);
    const systemPrompt = ENRICH_PROMPT_TEMPLATE.replace("{{JSON_INDEX_INPUT}}", jsonInput);

    // Generate content using OpenAI Chat Completions API
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const responseText = response.choices[0].message.content;
    
    if (!responseText) {
      return NextResponse.json(
        { error: "No response received from OpenAI API" },
        { status: 500 }
      );
    }

    // Clean and parse JSON
    const cleanedJson = cleanJsonResponse(responseText);
    
    let enrichedModules: EnrichedModulesResponse;
    try {
      enrichedModules = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Response text:", responseText);
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 500 }
      );
    }

    // Validate structure
    if (!enrichedModules.enriched_modules || !Array.isArray(enrichedModules.enriched_modules)) {
      return NextResponse.json(
        { error: "Invalid response structure from LLM" },
        { status: 500 }
      );
    }

    return NextResponse.json(enrichedModules);
  } catch (error: any) {
    console.error("Error enriching modules:", error);
    
    // Handle specific OpenAI API errors
    if (error.status === 401 || error.message?.includes("Invalid API key") || error.message?.includes("invalid_api_key")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your OPENAI_API_KEY configuration." },
        { status: 401 }
      );
    }

    if (error.status === 429 || error.message?.includes("rate_limit_exceeded") || error.message?.includes("quota")) {
      return NextResponse.json(
        { error: "API quota exceeded or rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (error.status === 402 || error.message?.includes("insufficient_quota")) {
      return NextResponse.json(
        { error: "Insufficient quota. Please check your OpenAI account billing." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred while enriching modules. Please try again." },
      { status: 500 }
    );
  }
}

