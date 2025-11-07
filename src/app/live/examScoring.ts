import { CV, Mat } from "@techstark/opencv-js";

import { ExamTemplate, ExamConfig } from "./types";

const BUBBLE_PADDING = 0.2;

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

export const bubbleContents = (roi: ROI): ROI => {
  const padX = Math.round(roi.w * BUBBLE_PADDING);
  const padY = Math.round(roi.h * BUBBLE_PADDING);
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
  bubbleNumber: number
): { fill: number; base64Image: string } => {
  const circleRoi = bubbleContents(roi);
  const bubbleMat = examMat.roi(
    new cv.Rect(circleRoi.x, circleRoi.y, circleRoi.w, circleRoi.h)
  );

  // Apply contrast enhancement to better distinguish filled vs unfilled bubbles
  const contrastMat = new cv.Mat();
  bubbleMat.convertTo(contrastMat, -1, 1.3, -20); // alpha=1.3 (contrast), beta=-20 (brightness)

  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = circleRoi.w;
  bubbleCanvas.height = circleRoi.h;
  cv.imshow(bubbleCanvas, contrastMat);

  // Convert canvas to base64 PNG
  const base64Image = bubbleCanvas.toDataURL("image/png");
  console.log(`Bubble Image ${questionNumber}-${bubbleNumber}: ${base64Image}`);

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

  // Scale factors in case the image isn't exactly `pageDimensions`
  const sx = matGray.cols / tplW;
  const sy = matGray.rows / tplH;

  const letterFor = (idx: number) => String.fromCharCode(65 + idx); // 0→A,1→B…

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
          o + 1
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

        // Check for clear single selection
        const hasValidSelection = darkest.fill >= markThresh;
        const hasSignificantDifference =
          darkest.fill - secondDarkest.fill >= markThresh / 2;

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
      const correctAnswer = questionConfig?.correctAnswer || "";
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
