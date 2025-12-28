import { NextRequest, NextResponse } from "next/server";
import type { LearningIndexResponse, EnrichedModulesResponse, Resource } from "@/types/learning";

function truncateQuery(query: string): string {
  if (query.length > 400) {
    return query.substring(0, 380);
  }
  return query;
}

interface TavilyResult {
  title: string;
  url: string;
  score: number;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.error("[Enrich API] ERROR: TAVILY_API_KEY is not set in environment variables");
    return NextResponse.json(
      { 
        error: "Server configuration error: TAVILY_API_KEY not set",
        details: "Please ensure TAVILY_API_KEY is configured in Vercel environment variables and redeploy."
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

    const enrichedModules: EnrichedModulesResponse = {
      enriched_modules: []
    };

    // Process each module
    for (const module of learningIndex.learning_modules) {
      const query = truncateQuery(module.title);
      console.log(`[Enrich API] Searching Tavily for module: "${module.title}" (query: "${query}")`);

      try {
        const tavilyResponse = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query: query,
            max_results: 2,
            include_raw_content: false
          })
        });

        if (!tavilyResponse.ok) {
          const errorData = await tavilyResponse.json().catch(() => ({ error: 'Unknown error' }));
          console.error(`[Enrich API] Tavily API error for module "${module.title}":`, {
            status: tavilyResponse.status,
            statusText: tavilyResponse.statusText,
            error: errorData
          });

          // Handle specific Tavily errors
          if (tavilyResponse.status === 401) {
            return NextResponse.json(
              { error: "Invalid Tavily API key. Please check your TAVILY_API_KEY configuration." },
              { status: 401 }
            );
          }

          if (tavilyResponse.status === 429) {
            return NextResponse.json(
              { error: "Tavily API rate limit exceeded. Please try again later." },
              { status: 429 }
            );
          }

          // Continue with empty resources for this module if it's not a critical error
          enrichedModules.enriched_modules.push({
            module_title: module.title,
            resources: []
          });
          continue;
        }

        const tavilyData: TavilyResponse = await tavilyResponse.json();

        // Map Tavily results to Resource interface
        const resources: Resource[] = (tavilyData.results || []).map((result: TavilyResult) => ({
          title: result.title,
          url: result.url,
          score: result.score,
          content: result.content
        }));

        console.log(`[Enrich API] Found ${resources.length} results for module "${module.title}"`);

        enrichedModules.enriched_modules.push({
          module_title: module.title,
          resources: resources
        });

      } catch (moduleError: any) {
        console.error(`[Enrich API] Error processing module "${module.title}":`, moduleError);
        // Continue with empty resources for this module
        enrichedModules.enriched_modules.push({
          module_title: module.title,
          resources: []
        });
      }
    }

    console.log("[Enrich API] Enrichment completed, total modules:", enrichedModules.enriched_modules.length);
    return NextResponse.json(enrichedModules);

  } catch (error: any) {
    console.error("[Enrich API] Error enriching modules:", {
      message: error?.message,
      stack: error?.stack
    });

    return NextResponse.json(
      { error: "An error occurred while enriching modules. Please try again." },
      { status: 500 }
    );
  }
}
