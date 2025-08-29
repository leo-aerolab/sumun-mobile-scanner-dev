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
  name: string;
  correctAnswer: string;
  points: number;
}

export interface ExamConfig {
  examId: string;
  examName: string;
  templateId: string; // References the template to use
  questions: ExamQuestion[];
}
