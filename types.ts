// This file defines the core data structures and types used throughout the application.

export type AppState = 'WELCOME' | 'SUBJECT_SELECTION' | 'TUTOR_SESSION';

export type PrebuiltVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface UserProfile {
  username: string;
  goal: string;
  subject: string;
  level: string;
  voice: PrebuiltVoice;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  modelImageUrl?: string;
  quizData?: GeneratedQuiz;
  userImage?: {
    base64: string;
    mimeType: string;
  };
  suggestedQuestions?: string[];
}

export interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

export interface GeneratedQuiz {
    questions: GeneratedQuestion[];
}

// FIX: Add missing VarkStyle and QuizQuestion types used in VarkQuiz.tsx.
export type VarkStyle = 'Visual' | 'Auditory' | 'ReadWrite' | 'Kinesthetic';

export interface QuizQuestion {
  question: string;
  options: {
    text: string;
    style: VarkStyle;
  }[];
}