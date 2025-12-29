export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface Resource {
  title: string;
  content: string;
  url: string;
  score: number;
  raw_content?: string;
}

export interface LearningModule {
  order: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  resources?: Resource[];
}

export interface EnrichedModule {
  module_title: string;
  resources: Resource[];
}

export interface EnrichedModulesResponse {
  enriched_modules: EnrichedModule[];
}

export interface LearningIndexResponse {
  main_topic: string;
  topic_summary: string;
  learning_modules: LearningModule[];
}

export interface TechnicalAnalysisResponse {
  response_structure: {
    section_A_technical_explanation: {
      content: string;
    };
    section_B_narrative_explanation: {
      content: string;
    };
    section_C_implementation_guide: {
      steps: Array<{
        step_number: number;
        action_title: string;
        why: string;
        how: string;
      }>;
    };
    section_D_quote_mining: {
      quotes: Array<{
        quote_text: string;
        editors_note: string;
      }>;
    };
    section_E_blind_spots: {
      content: string;
    };
  };
}




