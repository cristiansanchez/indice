import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LearningIndexResponse } from "@/types/learning";

const SYSTEM_PROMPT_TEMPLATE = `Act as an expert curriculum designer and educational analyst.

I will provide you with a text input. Your goal is to identify the core subject of that text and generate a comprehensive "Learning Index" or Syllabus for a student who wants to master this subject.

**Instructions:**
1. **Analyze the Topic:** Identify the main theme of the input text.
2. **Structure the Knowledge:** Create a logical, step-by-step learning path, based on the topic suggested by the user.
3. **Module Count:** Generate a maximum of 9 learning modules. Do not exceed this limit.
4. **Bridge the Gaps:**
    - If a concept is explicitly mentioned in the text, include it.
    - If a concept is crucial to understanding the topic but is missing from the text, you MUST add it to the index to ensure the learning path is complete.
5. **Output Format:** Return the response STRICTLY as a valid JSON object. Do not include markdown formatting (like \`\`\`json) or conversational text.

**JSON Schema:**
{
"main_topic": "A short title for the subject",
"topic_summary": "A brief 1-sentence overview of what the text is about",
"learning_modules": [
{
"order": number,
"title": "A full, self-explanatory title that explicitly includes the subject context (e.g., 'Legal Landscape of Crypto', not just 'Legal Landscape')",
"description": "A concise explanation of what will be learned (max 25 words)",
"difficulty": "Beginner" OR "Intermediate" OR "Advanced"
}
]
}

**Input Text:**
"""
{{TEXT_INPUT}}
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
  // Early debug logging - check API key availability immediately
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("[API Route] Environment check:", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : "N/A",
    nodeEnv: process.env.NODE_ENV,
    allGeminiVars: Object.keys(process.env).filter(key => 
      key.toUpperCase().includes("GEMINI") || key.toUpperCase().includes("API")
    ),
    timestamp: new Date().toISOString()
  });

  // Fail early if API key is missing
  if (!apiKey) {
    console.error("[API Route] ERROR: GEMINI_API_KEY is not set in environment variables");
    console.error("[API Route] Available env keys (filtered):", 
      Object.keys(process.env)
        .filter(key => key.includes("GEMINI") || key.includes("API") || key.includes("VERCEL"))
        .sort()
    );
    return NextResponse.json(
      { 
        error: "Server configuration error: GEMINI_API_KEY not set",
        details: "Please ensure GEMINI_API_KEY is configured in Vercel environment variables and redeploy."
      },
      { status: 500 }
    );
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text input is required and cannot be empty" },
        { status: 400 }
      );
    }

    console.log("[API Route] Processing text request, length:", text.length);

    // Initialize Gemini
    console.log("[API Route] Initializing Gemini client...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7
      }
    });
    console.log("[API Route] Gemini client initialized successfully");

    // Build full prompt combining system and user content
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{TEXT_INPUT}}", text);
    const fullPrompt = systemPrompt;

    // Generate content using Gemini API
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();
    
    if (!responseText) {
      return NextResponse.json(
        { error: "No response received from Gemini API" },
        { status: 500 }
      );
    }

    // Clean and parse JSON
    const cleanedJson = cleanJsonResponse(responseText);
    
    let learningIndex: LearningIndexResponse;
    try {
      learningIndex = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Response text:", responseText);
      return NextResponse.json(
        { error: "Failed to parse LLM response as JSON" },
        { status: 500 }
      );
    }

    // Validate structure
    if (
      !learningIndex.main_topic ||
      !learningIndex.topic_summary ||
      !Array.isArray(learningIndex.learning_modules)
    ) {
      return NextResponse.json(
        { error: "Invalid response structure from LLM" },
        { status: 500 }
      );
    }

    return NextResponse.json(learningIndex);
  } catch (error: any) {
    console.error("Error processing text:", error);
    
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
      { error: "An error occurred while processing your text. Please try again." },
      { status: 500 }
    );
  }
}

