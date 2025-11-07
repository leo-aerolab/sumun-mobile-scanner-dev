import { ExamConfig } from "./types";
import { getExamTemplateById } from "./examTemplateManager";

// Mock exam configurations
export const MOCK_EXAM_CONFIGS: Record<string, ExamConfig> = {
  "mock-diagnostic-local": {
    examId: "mock-diagnostic-local",
    examName: "Mock Diagnostic (Local)",
    templateId: "sumun-exam-diagnostic",
    questions: [
      { id: "q1", label: "Question 1", correctAnswer: "A", points: 1 },
      { id: "q2", label: "Question 2", correctAnswer: "A", points: 1 },
      { id: "q3", label: "Question 3", correctAnswer: "B", points: 1 },
      { id: "q4", label: "Question 4", correctAnswer: "C", points: 1 },
      { id: "q5", label: "Question 5", correctAnswer: "D", points: 1 },
      { id: "q6", label: "Question 6", correctAnswer: "A", points: 1 },
      { id: "q7", label: "Question 7", correctAnswer: "A", points: 1 },
      { id: "q8", label: "Question 8", correctAnswer: "B", points: 1 },
      { id: "q9", label: "Question 9", correctAnswer: "C", points: 1 },
      { id: "q10", label: "Question 10", correctAnswer: "D", points: 1 },
    ],
  },
  "mock-microtest-local": {
    examId: "mock-microtest-local",
    examName: "Mock Microtest (Local)",
    templateId: "sumun-exam-microtest",
    questions: [
      { id: "q1", label: "Science Q1", correctAnswer: "B", points: 1 },
      { id: "q2", label: "Science Q2", correctAnswer: "B", points: 1 },
      { id: "q3", label: "Science Q3", correctAnswer: "B", points: 1 },
      { id: "q4", label: "Science Q4", correctAnswer: "C", points: 1 },
      { id: "q5", label: "Science Q5", correctAnswer: "D", points: 1 },
    ],
  },
};

/**
 * Get exam config by ID
 */
export const getExamConfig = (examId: string): ExamConfig | null => {
  return MOCK_EXAM_CONFIGS[examId] || null;
};

/**
 * Get exam config by template ID (for dynamic selection)
 */
export const getExamConfigByTemplateId = (
  templateId: string
): ExamConfig | null => {
  const configs = Object.values(MOCK_EXAM_CONFIGS);
  return configs.find((config) => config.templateId === templateId) || null;
};

/**
 * Get all available exam config IDs
 */
export const getAvailableExamConfigIds = (): string[] => {
  return Object.keys(MOCK_EXAM_CONFIGS);
};

/**
 * Validate exam config against template
 */
export const validateExamConfig = (
  config: ExamConfig
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if config has required properties
  if (!config.examId || !config.examName || !config.templateId) {
    errors.push("Missing required exam config properties");
  }

  if (!config.questions || !Array.isArray(config.questions)) {
    errors.push("Missing or invalid questions array");
  }

  // Get the template to validate against
  const template = getExamTemplateById(config.templateId);
  if (!template) {
    errors.push(`Template not found: ${config.templateId}`);
    return { isValid: errors.length === 0, errors, warnings };
  }

  // Calculate total questions from template fieldBlocks
  const totalTemplateQuestions =
    template.fieldBlocks?.reduce(
      (sum: number, block: any) => sum + (block.numQuestions || 0),
      0
    ) || 0;

  // Check if config questions match template capacity
  if (config.questions.length !== totalTemplateQuestions) {
    errors.push(
      `Config has ${config.questions.length} questions but template supports ${totalTemplateQuestions}`
    );
  }

  // Validate each question has required properties
  config.questions?.forEach((question, index) => {
    if (!question.id) {
      errors.push(`Question ${index + 1} missing id`);
    }
    if (!question.correctAnswer) {
      errors.push(`Question ${index + 1} missing correctAnswer`);
    }
    if (question.points <= 0) {
      warnings.push(`Question ${index + 1} has zero or negative points`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};
