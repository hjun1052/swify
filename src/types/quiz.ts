export type QuizQuestionType = "multiple_choice" | "open";

export interface QuizOption {
  id: string;
  label: string;
  description?: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  framingNote?: string;
  options?: QuizOption[];
}

export interface QuizAnswer {
  questionId: string;
  answer: string;
  reasoning?: string;
}

export interface QuizEvaluation {
  overallReflection: string;
  questionFeedback: {
    questionId: string;
    feedback: string;
    nudge?: string;
  }[];
}
