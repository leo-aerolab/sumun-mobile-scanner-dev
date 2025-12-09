export interface ExamTemplate {
  pageDimensions: number[];
  readBlocks?: {
    name: string;
    numCharacters: number;
    type: string;
    top: number;
    left: number;
    width: number;
    height: number;
  }[];
  fieldBlocks: {
    name: string;
    top: number;
    left: number;
    width: number;
    height: number;
    gapX?: number;
    gapY?: number;
    numOptions: number;
    numQuestions: number;
    questions: {
      name: string;
      correctAnswer: string;
      points: number;
    }[];
  }[];
  visionBlock: {
    top: number;
    left: number;
    width: number;
    height: number;
    extract: string[];
  };
  // Optional per-template bubble detection thresholds
  // If not provided, defaults are used (markThresh: 0.3, minDelta: markThresh/2)
  bubbleDetection?: {
    markThresh?: number; // Minimum darkness (0-1) to consider bubble filled
    minDelta?: number; // Minimum difference between darkest and second-darkest bubble
    bubbleShape?: "circle" | "rectangle"; // Shape of bubbles: "circle" (default) or "rectangle"
    padding?: number; // Padding percentage (0-1) to apply when extracting bubble content. Default: 0.2 for circles, 0.1 for rectangles
  };
}

// New exam config interface for questions/answers
export interface ExamQuestion {
  id: string;
  label: string;
  correctAnswer: string;
  points: number;
}

export interface ExamStudent {
  id: string;
  name: string;
  lastname: string;
  username?: string;
  ref_id?: string;
}

export interface ExamConfig {
  examId: string;
  examName: string;
  templateId: string; // References the template to use
  questions: ExamQuestion[];
  students?: ExamStudent[];
}
