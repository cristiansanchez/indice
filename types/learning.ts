export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type SourceType = "Derived from Text" | "Recommended Expansion";

export interface LearningModule {
  order: number;
  title: string;
  description: string;
  source_type: SourceType;
  difficulty: Difficulty;
}

export interface LearningIndexResponse {
  main_topic: string;
  topic_summary: string;
  learning_modules: LearningModule[];
}

