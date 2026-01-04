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

async function callOpenAIAPI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const { text, model } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text input is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Validate model if provided
    const allowedModels = [
      "gemini-2.5-flash",
      "deepseek-chat",
      "deepseek-reasoner",
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5.2-chat-latest",
      "gpt-5.1-chat-latest",
      "gpt-5-chat-latest",
      "gpt-5.1-codex-max",
      "gpt-5.1-codex",
      "gpt-5-codex",
      "gpt-5.2-pro"
    ];
    const modelName = model || "gemini-2.5-flash";
    if (model && !allowedModels.includes(model)) {
      return NextResponse.json(
        { error: "Invalid model specified" },
        { status: 400 }
      );
    }

    // Determine provider and get appropriate API key
    const isDeepSeek = modelName.startsWith("deepseek-");
    const isOpenAI = modelName.startsWith("gpt-");
    const providerApiKey = isDeepSeek 
      ? process.env.DEEPSEEK_API_KEY 
      : isOpenAI
      ? process.env.OPENAI_API_KEY
      : process.env.GEMINI_API_KEY;
    
    if (!providerApiKey) {
      const providerName = isDeepSeek ? "DEEPSEEK_API_KEY" : isOpenAI ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
      return NextResponse.json(
        { 
          error: `Server configuration error: ${providerName} not set`,
          details: `Please ensure ${providerName} is configured in Vercel environment variables and redeploy.`
        },
        { status: 500 }
      );
    }

    console.log("[API Route] Processing text request, length:", text.length, "model:", modelName);

    // Build full prompt combining system and user content
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{TEXT_INPUT}}", text);
    const fullPrompt = systemPrompt;

    // Generate content using appropriate API
    let responseText: string;
    
    if (isDeepSeek) {
      console.log("[API Route] Calling DeepSeek API with model:", modelName);
      responseText = await callDeepSeekAPI(providerApiKey, modelName, fullPrompt);
    } else if (isOpenAI) {
      console.log("[API Route] Calling OpenAI API with model:", modelName);
      responseText = await callOpenAIAPI(providerApiKey, modelName, fullPrompt);
    } else {
      console.log("[API Route] Initializing Gemini client...");
      const genAI = new GoogleGenerativeAI(providerApiKey);
      const geminiModel = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      });
      console.log("[API Route] Gemini client initialized successfully");
      
      const result = await geminiModel.generateContent(fullPrompt);
      const response = await result.response;
      responseText = response.text();
    }
    
    if (!responseText) {
      const providerName = isDeepSeek ? "DeepSeek" : isOpenAI ? "OpenAI" : "Gemini";
      return NextResponse.json(
        { error: `No response received from ${providerName} API` },
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
    
    // Handle specific API errors (works for Gemini, DeepSeek, and OpenAI)
    if (error.status === 401 || error.message?.includes("Invalid API key") || error.message?.includes("invalid_api_key") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("DeepSeek API error: 401") || error.message?.includes("OpenAI API error: 401")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your API key configuration." },
        { status: 401 }
      );
    }

    if (error.status === 429 || error.message?.includes("rate_limit_exceeded") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("DeepSeek API error: 429") || error.message?.includes("OpenAI API error: 429")) {
      return NextResponse.json(
        { error: "API quota exceeded or rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (error.status === 402 || error.message?.includes("insufficient_quota") || error.message?.includes("DeepSeek API error: 402") || error.message?.includes("OpenAI API error: 402")) {
      return NextResponse.json(
        { error: "Insufficient quota. Please check your account billing." },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred while processing your text. Please try again." },
      { status: 500 }
    );
  }
}

