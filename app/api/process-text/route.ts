import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LearningIndexResponse } from "@/types/learning";

const SYSTEM_PROMPT_TEMPLATE = `Act as an expert curriculum designer and educational analyst.

I will provide you with a text input. Your goal is to identify the core subject of that text and generate a comprehensive "Learning Index" or Syllabus for a student who wants to master this subject.

**Instructions:**
1. **Analyze the Topic:** Identify the main theme of the input text.
2. **Structure the Knowledge:** Create a logical, step-by-step learning path, starting from fundamental concepts to advanced implications.
3. **Bridge the Gaps:**
    - If a concept is explicitly mentioned in the text, include it.
    - If a concept is crucial to understanding the topic but is missing from the text, you MUST add it to the index to ensure the learning path is complete.
4. **Output Format:** Return the response STRICTLY as a valid JSON object. Do not include markdown formatting (like \`\`\`json) or conversational text.

**JSON Schema:**
{
"main_topic": "A short title for the subject",
"topic_summary": "A brief 1-sentence overview of what the text is about",
"learning_modules": [
{
"order": number,
"title": "Title of the concept/module",
"description": "A concise explanation of what will be learned (max 25 words)",
"source_type": "Derived from Text" OR "Recommended Expansion",
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
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text input is required and cannot be empty" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error: GOOGLE_API_KEY not set" },
        { status: 500 }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Build prompt with user's text
    const prompt = SYSTEM_PROMPT_TEMPLATE.replace("{{TEXT_INPUT}}", text);

    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

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
    if (error.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid API key. Please check your GOOGLE_API_KEY configuration." },
        { status: 401 }
      );
    }

    if (error.message?.includes("quota") || error.message?.includes("rate limit")) {
      return NextResponse.json(
        { error: "API quota exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred while processing your text. Please try again." },
      { status: 500 }
    );
  }
}

