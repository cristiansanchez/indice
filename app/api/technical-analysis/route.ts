import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TechnicalAnalysisResponse } from "@/types/learning";

const TECHNICAL_ANALYSIS_PROMPT = `You are an expert knowledge management system. Analyze the following text and extract structured knowledge into a JSON format that is optimized for personal learning databases.

SECTION A - Technical Explanation (80-110 words):
Rewrite the text using technical, precise, and formal language. High information density. Focus on methodology and data.

SECTION B - Narrative Explanation (80-110 words):
Transform the content into a fluid narrative essay. Connect ideas logically like a story. Use metaphors if needed.

SECTION C - Implementation Guide:
Create 3 numbered steps for immediate execution. Each step must include:
- action_title: Clear action name
- why: Justification based explicitly on the text
- how: Specific execution method

SECTION D - Quote Mining:
Extract the 2 most brilliant verbatim quotes with high information density. For each quote provide an editor's note (max 20 words) explaining why it's vital and its hidden nuance.

SECTION E - Analysis of Blind Spots (max 50 words):
What does the text NOT say? What questions are unanswered? In what scenarios would this fail?

TEXT TO ANALYZE:
{{CONTENT}}

Respond with ONLY a valid JSON object following this structure:
{
  "response_structure": {
    "section_A_technical_explanation": {
      "content": "string"
    },
    "section_B_narrative_explanation": {
      "content": "string"
    },
    "section_C_implementation_guide": {
      "steps": [
        {
          "step_number": 1,
          "action_title": "string",
          "why": "string",
          "how": "string"
        },
        {
          "step_number": 2,
          "action_title": "string",
          "why": "string",
          "how": "string"
        },
        {
          "step_number": 3,
          "action_title": "string",
          "why": "string",
          "how": "string"
        }
      ]
    },
    "section_D_quote_mining": {
      "quotes": [
        {
          "quote_text": "string",
          "editors_note": "string"
        },
        {
          "quote_text": "string",
          "editors_note": "string"
        }
      ]
    },
    "section_E_blind_spots": {
      "content": "string"
    }
  }
}`;

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

async function callDeepSeekAPI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`DeepSeek API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const { raw_content, model } = await request.json();

    if (!raw_content || typeof raw_content !== "string" || raw_content.trim().length === 0) {
      return NextResponse.json(
        { error: "Raw content is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Validate model if provided
    const allowedModels = ["gemini-2.5-flash", "deepseek-chat", "deepseek-reasoner"];
    const modelName = model || "gemini-2.5-flash";
    if (model && !allowedModels.includes(model)) {
      return NextResponse.json(
        { error: "Invalid model specified" },
        { status: 400 }
      );
    }

    // Determine provider and get appropriate API key
    const isDeepSeek = modelName.startsWith("deepseek-");
    const providerApiKey = isDeepSeek 
      ? process.env.DEEPSEEK_API_KEY 
      : process.env.GEMINI_API_KEY;
    
    if (!providerApiKey) {
      return NextResponse.json(
        { 
          error: `Server configuration error: ${isDeepSeek ? "DEEPSEEK_API_KEY" : "GEMINI_API_KEY"} not set`,
          details: `Please ensure ${isDeepSeek ? "DEEPSEEK_API_KEY" : "GEMINI_API_KEY"} is configured in Vercel environment variables and redeploy.`
        },
        { status: 500 }
      );
    }

    console.log("[Technical Analysis API] Processing analysis request, content length:", raw_content.length, "model:", modelName);

    // Build full prompt
    const fullPrompt = TECHNICAL_ANALYSIS_PROMPT.replace("{{CONTENT}}", raw_content);

    // Generate content using appropriate API
    let responseText: string;
    
    if (isDeepSeek) {
      console.log("[Technical Analysis API] Calling DeepSeek API with model:", modelName);
      responseText = await callDeepSeekAPI(providerApiKey, modelName, fullPrompt);
    } else {
      console.log("[Technical Analysis API] Initializing Gemini client...");
      const genAI = new GoogleGenerativeAI(providerApiKey);
      const geminiModel = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });
      console.log("[Technical Analysis API] Gemini client initialized successfully");
      
      const result = await geminiModel.generateContent(fullPrompt);
      const response = await result.response;
      responseText = response.text();
    }
    
    if (!responseText) {
      return NextResponse.json(
        { error: `No response received from ${isDeepSeek ? "DeepSeek" : "Gemini"} API` },
        { status: 500 }
      );
    }

    // Clean and parse JSON
    const cleanedJson = cleanJsonResponse(responseText);
    
    let analysisResult: TechnicalAnalysisResponse;
    try {
      analysisResult = JSON.parse(cleanedJson);
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
      !analysisResult.response_structure ||
      !analysisResult.response_structure.section_A_technical_explanation ||
      !analysisResult.response_structure.section_B_narrative_explanation ||
      !analysisResult.response_structure.section_C_implementation_guide ||
      !analysisResult.response_structure.section_D_quote_mining ||
      !analysisResult.response_structure.section_E_blind_spots
    ) {
      return NextResponse.json(
        { error: "Invalid response structure from LLM" },
        { status: 500 }
      );
    }

    return NextResponse.json(analysisResult);
  } catch (error: any) {
    console.error("Error processing technical analysis:", error);
    
    // Handle specific API errors
    if (error.status === 401 || error.message?.includes("Invalid API key") || error.message?.includes("invalid_api_key") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("DeepSeek API error: 401")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your API key configuration." },
        { status: 401 }
      );
    }

    if (error.status === 429 || error.message?.includes("rate_limit_exceeded") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("DeepSeek API error: 429")) {
      return NextResponse.json(
        { error: "API quota exceeded or rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (error.status === 402 || error.message?.includes("insufficient_quota") || error.message?.includes("DeepSeek API error: 402")) {
      return NextResponse.json(
        { error: "Insufficient quota. Please check your account billing." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred while processing the technical analysis. Please try again." },
      { status: 500 }
    );
  }
}

