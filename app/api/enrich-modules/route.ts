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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:69',message:'extractUrlsFromGrounding entry',data:{hasGroundingMetadata:!!groundingMetadata,hasGroundingChunks:!!groundingMetadata?.groundingChunks,chunksType:typeof groundingMetadata?.groundingChunks,isArray:Array.isArray(groundingMetadata?.groundingChunks),chunksLength:groundingMetadata?.groundingChunks?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  const urlMap = new Map<string, { uri: string, title: string }>();
  
  if (groundingMetadata?.groundingChunks) {
    try {
      groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:78',message:'Processing chunk',data:{chunkIndex:index,hasChunk:!!chunk,chunkKeys:chunk ? Object.keys(chunk) : [],hasWeb:!!chunk?.web,webKeys:chunk?.web ? Object.keys(chunk.web) : [],hasUri:!!chunk?.web?.uri,hasTitle:!!chunk?.web?.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (chunk.web?.uri && chunk.web?.title) {
          // Usar title como clave para hacer match con los recursos
          urlMap.set(chunk.web.title.toLowerCase(), {
            uri: chunk.web.uri,
            title: chunk.web.title
          });
        }
      });
    } catch (forEachError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:88',message:'forEach error in extractUrlsFromGrounding',data:{errorMessage:forEachError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw forEachError;
    }
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:94',message:'extractUrlsFromGrounding exit',data:{urlMapSize:urlMap.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:110',message:'Before model initialization',data:{modulesCount:learningIndex.learning_modules.length,hasApiKey:!!apiKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:115',message:'Before getGenerativeModel with tools',data:{model:'gemini-2.5-flash',hasTools:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Initialize model - temporarily without tools to test if tools are causing the error
    // If this works, we'll add tools back with proper error handling
    console.log("[Enrich API] Initializing model WITHOUT tools (testing phase)");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
      // tools: [
      //   {
      //     google_search: {}
      //   } as any
      // ]
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:125',message:'Model initialized successfully',data:{modelType:typeof model},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Build prompt with JSON input
    const jsonInput = JSON.stringify(learningIndex, null, 2);
    const fullPrompt = ENRICH_PROMPT_TEMPLATE.replace("{{JSON_INDEX_INPUT}}", jsonInput);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:132',message:'Before generateContent call',data:{promptLength:fullPrompt.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log("[Enrich API] About to call generateContent with tools:", {
      model: "gemini-2.5-flash",
      hasTools: true,
      promptLength: fullPrompt.length
    });

    // Generate content using Gemini API
    let result: any;
    try {
      result = await model.generateContent(fullPrompt);
      console.log("[Enrich API] generateContent succeeded");
    } catch (genError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:137',message:'generateContent error',data:{errorMessage:genError?.message,errorStatus:genError?.status,errorStack:genError?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error("[Enrich API] generateContent error:", {
        message: genError?.message,
        status: genError?.status,
        name: genError?.name,
        stack: genError?.stack,
        cause: genError?.cause,
        response: genError?.response
      });
      throw genError;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:143',message:'After generateContent, before accessing response',data:{hasResult:!!result,resultKeys:result ? Object.keys(result) : []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    const response = await result.response;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:148',message:'After getting response, before accessing groundingMetadata',data:{hasResponse:!!response,responseKeys:response ? Object.keys(response) : [],hasResponseGrounding:!!(response as any)?.groundingMetadata,hasResultGrounding:!!(result as any)?.groundingMetadata},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Acceder a groundingMetadata si está disponible (puede estar en result o response)
    const groundingMetadata = (response as any).groundingMetadata || (result as any).groundingMetadata;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:153',message:'After accessing groundingMetadata',data:{hasGroundingMetadata:!!groundingMetadata,groundingKeys:groundingMetadata ? Object.keys(groundingMetadata) : [],hasGroundingChunks:!!groundingMetadata?.groundingChunks,chunksLength:groundingMetadata?.groundingChunks?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:168',message:'Before JSON parsing',data:{cleanedJsonLength:cleanedJson.length,cleanedJsonStart:cleanedJson.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    let enrichedModules: EnrichedModulesResponse;
    try {
      enrichedModules = JSON.parse(cleanedJson);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:174',message:'JSON parsed successfully',data:{modulesCount:enrichedModules?.enriched_modules?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } catch (parseError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:177',message:'JSON parse error',data:{errorMessage:parseError?.message,cleanedJsonStart:cleanedJson.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:190',message:'Before extractUrlsFromGrounding',data:{hasGroundingMetadata:true,groundingChunksType:typeof groundingMetadata.groundingChunks,isArray:Array.isArray(groundingMetadata.groundingChunks)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      let verifiedUrls: Map<string, { uri: string, title: string }>;
      try {
        verifiedUrls = extractUrlsFromGrounding(groundingMetadata);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:195',message:'After extractUrlsFromGrounding',data:{verifiedUrlsCount:verifiedUrls.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      } catch (extractError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:198',message:'extractUrlsFromGrounding error',data:{errorMessage:extractError?.message,groundingMetadataKeys:groundingMetadata ? Object.keys(groundingMetadata) : []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw extractError;
      }
      
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/53d5bfd5-5b12-4767-834f-705673023f5f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'enrich-modules/route.ts:220',message:'Catch block - main error',data:{errorMessage:error?.message,errorStatus:error?.status,errorName:error?.name,errorStack:error?.stack?.substring(0,500),errorStringified:JSON.stringify(error).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    console.error("[Enrich API] Error enriching modules:", {
      message: error?.message,
      status: error?.status,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause,
      response: error?.response,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
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

