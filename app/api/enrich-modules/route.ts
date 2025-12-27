import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LearningIndexResponse, EnrichedModulesResponse } from "@/types/learning";

const ENRICH_PROMPT_TEMPLATE = `Act as an expert academic researcher and librarian.

I will provide you with a "Learning Index" in JSON format, containing a list of learning modules/topics.
Your task is to curate **2 high-quality external resources** (articles, research papers, or authoritative documentation) for EACH module in the list to help the user study that specific concept.

**Instructions:**

1.  **Process:** Iterate through every item in the provided \`learning_modules\` list.
2.  **Selection Criteria:**
    *   Select resources that are highly relevant, credible, and educational.
    *   Prioritize open-access papers (arXiv), reputable tech blogs (like Mozilla MDN, Vercel Blog, Medium curated), or recognized academic journals.
    *   **IMPORTANT: All URLs must point to real, existing resources. Do not invent or create fictional URLs. Only provide URLs to actual published content that you can verify exists.**
3.  **Formatting:**
    *   **Title:** The exact title of the article or paper.
    *   **Description:** A concise, one-line summary of why this resource is valuable for this specific topic.
    *   **URL:** A direct link to the resource. **CRITICAL: URLs must be real, existing, and verifiable resources. Do not invent, create, or generate fictional URLs. Only provide URLs to actual published content. Use Google Search to find real, existing resources.**
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

function extractUrlsFromGrounding(groundingMetadata: any): Map<string, { uri: string, title: string }> {
  const urlMap = new Map<string, { uri: string, title: string }>();
  
  if (groundingMetadata?.groundingChunks) {
    groundingMetadata.groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri && chunk.web?.title) {
        // Usar title como clave para hacer match con los recursos
        urlMap.set(chunk.web.title.toLowerCase(), {
          uri: chunk.web.uri,
          title: chunk.web.title
        });
      }
    });
  }
  
  return urlMap;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { 
        error: "Server configuration error: GEMINI_API_KEY not set",
        details: "Please ensure GEMINI_API_KEY is configured in Vercel environment variables and redeploy."
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

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      },
      tools: [
        {
          googleSearch: {}
        } as any
      ]
    });

    // Build prompt with JSON input
    const jsonInput = JSON.stringify(learningIndex, null, 2);
    const fullPrompt = ENRICH_PROMPT_TEMPLATE.replace("{{JSON_INDEX_INPUT}}", jsonInput);

    // Generate content using Gemini API
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    
    // Acceder a groundingMetadata si está disponible (puede estar en result o response)
    const groundingMetadata = (response as any).groundingMetadata || (result as any).groundingMetadata;
    const responseText = response.text();
    
    if (!responseText) {
      return NextResponse.json(
        { error: "No response received from Gemini API" },
        { status: 500 }
      );
    }

    // Logging para debugging
    if (groundingMetadata) {
      console.log("[Enrich API] Grounding metadata available:", {
        chunksCount: groundingMetadata.groundingChunks?.length || 0,
        searchQueries: groundingMetadata.webSearchQueries || []
      });
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

    // Extraer URLs verificadas del groundingMetadata y combinarlas con el JSON
    if (groundingMetadata) {
      const verifiedUrls = extractUrlsFromGrounding(groundingMetadata);
      
      if (verifiedUrls.size > 0) {
        console.log("[Enrich API] Found", verifiedUrls.size, "verified URLs from grounding metadata");
        
        // Reemplazar URLs en el JSON con URLs verificadas cuando sea posible
        enrichedModules.enriched_modules.forEach((module) => {
          module.resources.forEach((resource) => {
            // Intentar hacer match por título
            const verified = verifiedUrls.get(resource.title.toLowerCase());
            if (verified) {
              console.log("[Enrich API] Replacing URL for:", resource.title, "->", verified.uri);
              resource.url = verified.uri;
            }
          });
        });
      }
    }

    return NextResponse.json(enrichedModules);
  } catch (error: any) {
    console.error("Error enriching modules:", error);
    
    // Handle specific Gemini API errors
    if (error.status === 401 || error.message?.includes("Invalid API key") || error.message?.includes("invalid_api_key") || error.message?.includes("API_KEY_INVALID")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your GEMINI_API_KEY configuration." },
        { status: 401 }
      );
    }

    if (error.status === 429 || error.message?.includes("rate_limit_exceeded") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        { error: "API quota exceeded or rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (error.status === 402 || error.message?.includes("insufficient_quota")) {
      return NextResponse.json(
        { error: "Insufficient quota. Please check your Gemini account billing." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred while enriching modules. Please try again." },
      { status: 500 }
    );
  }
}

