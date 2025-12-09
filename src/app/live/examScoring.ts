import { CV, Mat } from "@techstark/opencv-js";

import { ExamTemplate, ExamConfig } from "./types";

const DEFAULT_BUBBLE_PADDING = 0.2; // Default padding for circles
const RECTANGLE_BUBBLE_PADDING = 0.1; // Less padding for rectangles

export type ROI = { x: number; y: number; w: number; h: number };

// Enhanced bubble structure to include all analysis data
export type AnalyzedBubble = {
  option: string;
  confidence: number;
  isSelected: boolean;
  base64Image: string;
};

// Updated result structure with all bubbles and selection logic
export type QuestionResult = {
  questionId: string;
  questionLabel: string;
  bubbles: AnalyzedBubble[];
  selectedAnswer: string; // Single letter, empty if none, "?" if multiple/doubt
  correctAnswer: string;
  confidence: number; // Overall confidence in the selection
  answerPoints: number;
  pointsAchieved: number;
};

export type ExamResult = {
  questions: QuestionResult[];
  totalPoints: number;
  pointsAchieved: number;
  percentage: number;
};

/**
 * Extract the content area of a bubble, applying appropriate padding based on shape
 * @param roi - The full ROI of the bubble
 * @param bubbleShape - Shape of the bubble: "circle" (default) or "rectangle"
 * @param customPadding - Optional custom padding (0-1). If not provided, uses defaults
 */
export const bubbleContents = (
  roi: ROI,
  bubbleShape: "circle" | "rectangle" = "circle",
  customPadding?: number
): ROI => {
  // Determine padding based on shape
  const padding = customPadding ?? (
    bubbleShape === "rectangle" ? RECTANGLE_BUBBLE_PADDING : DEFAULT_BUBBLE_PADDING
  );
  
  const padX = Math.round(roi.w * padding);
  const padY = Math.round(roi.h * padding);
  return {
    x: roi.x + padX,
    y: roi.y + padY,
    w: roi.w - 2 * padX,
    h: roi.h - 2 * padY,
  };
};

/** 0 = white, 1 = black ‒ no thresholding, no morphology, just luminance */
export const evaluateBubble = (
  cv: CV,
  examMat: Mat,
  roi: ROI,
  questionNumber: number,
  bubbleNumber: number,
  bubbleShape: "circle" | "rectangle" = "circle",
  customPadding?: number
): { fill: number; base64Image: string } => {
  const bubbleRoi = bubbleContents(roi, bubbleShape, customPadding);
  const bubbleMat = examMat.roi(
    new cv.Rect(bubbleRoi.x, bubbleRoi.y, bubbleRoi.w, bubbleRoi.h)
  );

  // Apply contrast enhancement to better distinguish filled vs unfilled bubbles
  const contrastMat = new cv.Mat();
  bubbleMat.convertTo(contrastMat, -1, 1.3, -20); // alpha=1.3 (contrast), beta=-20 (brightness)

  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = bubbleRoi.w;
  bubbleCanvas.height = bubbleRoi.h;
  cv.imshow(bubbleCanvas, contrastMat);

  // Convert canvas to base64 PNG
  const base64Image = bubbleCanvas.toDataURL("image/png");

  const mean = cv.mean(contrastMat)[0]; // 0‒255, 0 = black
  bubbleMat.delete();
  contrastMat.delete();

  const fill = (255 - mean) / 255; // normalise to 0‒1 darkness

  return { fill, base64Image };
};

/**
 * Score all answer blocks in one shot.
 *
 * @param cv        – OpenCV instance
 * @param matGray   – *processed* exam image (grayscale, same size as template.pageDimensions)
 * @param template  – examTemplate (fieldBlocks, etc.)
 * @param examConfig – exam configuration with questions/answers
 * @param markThresh– proportion of black pixels that counts as a "filled-in" bubble
 *
 * @returns ExamResult with complete question details including scores and correct answers
 */
export const scoreExam = async (
  cv: CV,
  matGray: Mat,
  template: ExamTemplate,
  examConfig: ExamConfig,
  markThresh = 0.3
): Promise<ExamResult> => {
  const [tplW, tplH] = template.pageDimensions;

  // Use per-template threshold overrides if available, otherwise use parameter/default
  const effectiveMarkThresh = template.bubbleDetection?.markThresh ?? markThresh;
  const effectiveMinDelta = template.bubbleDetection?.minDelta ?? effectiveMarkThresh / 2;
  const bubbleShape = template.bubbleDetection?.bubbleShape ?? "circle";
  const customPadding = template.bubbleDetection?.padding;

  // Log threshold configuration for debugging
  if (template.bubbleDetection) {
    console.log(`📊 Using template-specific settings: markThresh=${effectiveMarkThresh}, minDelta=${effectiveMinDelta}, bubbleShape=${bubbleShape}, padding=${customPadding ?? (bubbleShape === "rectangle" ? RECTANGLE_BUBBLE_PADDING : DEFAULT_BUBBLE_PADDING)}`);
  }

  // Scale factors in case the image isn't exactly `pageDimensions`
  const sx = matGray.cols / tplW;
  const sy = matGray.rows / tplH;

  const letterFor = (idx: number) => String.fromCharCode(65 + idx); // 0→A,1→B…

  /**
   * Converts correctAnswer from integer string format to letter format.
   * Supports both formats for backward compatibility:
   * - Integer string: "0" → "A", "1" → "B", "2" → "C", etc.
   * - Letter: "A" → "A", "B" → "B" (unchanged)
   */
  const normalizeCorrectAnswer = (correctAnswer: string): string => {
    // If it's already a letter (A-Z), return as-is
    if (/^[A-Z]$/.test(correctAnswer)) {
      return correctAnswer;
    }
    
    // Try to parse as integer string
    const index = parseInt(correctAnswer, 10);
    if (!isNaN(index) && index >= 0) {
      return letterFor(index);
    }
    
    // If neither format, return as-is (fallback)
    return correctAnswer;
  };

  const questions: QuestionResult[] = [];
  let totalPoints = 0;
  let totalPointsAchieved = 0;
  let questionIndex = 0; // Global question index across all blocks

  for (const block of template.fieldBlocks) {
    const {
      top,
      left,
      width,
      height,
      numOptions,
      numQuestions,
      gapX,
      gapY,
    } = block;

    const cellW = (width - (gapX || 0) * (numOptions - 1)) / numOptions;
    const cellH = (height - (gapY || 0) * (numQuestions - 1)) / numQuestions;

    for (let q = 0; q < numQuestions; q++) {
      // First, collect all scores for this question
      const optionScores: {
        option: string;
        fill: number;
        base64Image: string;
      }[] = [];

      for (let o = 0; o < numOptions; o++) {
        const roi = {
          x: Math.round((left + o * cellW + o * (gapX || 0)) * sx),
          y: Math.round((top + q * cellH + q * (gapY || 0)) * sy),
          w: Math.round(cellW * sx),
          h: Math.round(cellH * sy),
        };

        const { fill, base64Image } = evaluateBubble(
          cv,
          matGray,
          roi,
          q + 1,
          o + 1,
          bubbleShape,
          customPadding
        );

        optionScores.push({ option: letterFor(o), fill, base64Image });
      }

      // Sort by fill value (darkest first)
      optionScores.sort((a, b) => b.fill - a.fill);

      // Create AnalyzedBubble objects for all options
      const bubbles: AnalyzedBubble[] = [];
      let selectedAnswer = "";
      let overallConfidence = 0;

      // Determine selection logic
      if (optionScores.length > 0) {
        const darkest = optionScores[0];
        const secondDarkest =
          optionScores.length > 1 ? optionScores[1] : { fill: 0 };

        // Check for clear single selection using effective thresholds
        const hasValidSelection = darkest.fill >= effectiveMarkThresh;
        const hasSignificantDifference =
          darkest.fill - secondDarkest.fill >= effectiveMinDelta;

        // Create bubble objects for all options
        for (const score of optionScores) {
          const isSelected =
            hasValidSelection &&
            hasSignificantDifference &&
            score.option === darkest.option;
          bubbles.push({
            option: score.option,
            confidence: score.fill,
            base64Image: score.base64Image,
            isSelected,
          });
        }

        // Determine selectedAnswer based on criteria
        if (hasValidSelection && hasSignificantDifference) {
          selectedAnswer = darkest.option;
          overallConfidence = darkest.fill;
        } else if (hasValidSelection) {
          // Multiple potential selections (ambiguous)
          selectedAnswer = "?";
          overallConfidence = darkest.fill;
        } else {
          // No clear selection
          selectedAnswer = "";
          overallConfidence = 0;
        }
      }

      // Get question details from exam config instead of template
      const questionConfig = examConfig.questions[questionIndex];
      const questionId = questionConfig?.id;
      const questionLabel = questionConfig?.label || `Q${questionIndex + 1}`;
      const rawCorrectAnswer = questionConfig?.correctAnswer || "";
      // Normalize correctAnswer from integer string ("0", "1", etc.) to letter ("A", "B", etc.)
      const correctAnswer = normalizeCorrectAnswer(rawCorrectAnswer);
      const answerPoints = questionConfig?.points || 1;

      // Calculate points achieved
      const isCorrect = selectedAnswer === correctAnswer;
      const pointsAchieved = isCorrect ? answerPoints : 0;

      // Add to totals
      totalPoints += answerPoints;
      totalPointsAchieved += pointsAchieved;

      // Create question result
      const questionResult: QuestionResult = {
        questionId,
        questionLabel,
        bubbles,
        selectedAnswer,
        correctAnswer,
        confidence: overallConfidence,
        answerPoints,
        pointsAchieved,
      };

      questions.push(questionResult);
      questionIndex++;
    }
  }

  const percentage =
    totalPoints > 0 ? (totalPointsAchieved / totalPoints) * 100 : 0;

  return {
    questions,
    totalPoints,
    pointsAchieved: totalPointsAchieved,
    percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
  };
};
