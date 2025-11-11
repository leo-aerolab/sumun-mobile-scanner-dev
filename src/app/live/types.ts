export interface ExamTemplate {
  pageDimensions: number[];
  readBlocks: {
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
  username: string;
  ref_id: string;
}

export interface ExamConfig {
  examId: string;
  examName: string;
  templateId: string; // References the template to use
  questions: ExamQuestion[];
  students?: ExamStudent[];
}
