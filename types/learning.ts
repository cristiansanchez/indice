export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export interface LearningModule {
  order: number;
  title: string;
  description: string;
  difficulty: Difficulty;
}

export interface LearningIndexResponse {
  main_topic: string;
  topic_summary: string;
  learning_modules: LearningModule[];
}




