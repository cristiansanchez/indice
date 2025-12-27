export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface Resource {
  title: string;
  description: string;
  url: string;
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




