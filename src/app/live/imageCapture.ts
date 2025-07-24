import { CV } from "@techstark/opencv-js";
import { ExamPersonalInfoType } from "../api/vision/libs";
import { readPersonalInfo } from "./examOCRopenai";
import { ExamResult, scoreExam } from "./examScoring";
import { preprocessForMorphology } from "./imageProcessing";
import {
  applyPiecewiseTransformation,
  Detection,
  organizeMarkers,
} from "./markerDetection";
import { ExamTemplate } from "./types";
import { identifyExamType } from "./examSignature";
import { getExamTemplate, validateTemplate, getTemplateSummary } from "./examTemplateManager";

export interface CaptureResult {
  originalDataURL: string;
  processedDataURL: string;
  examResults: ExamResult;
  personalInfoPromise: Promise<ExamPersonalInfoType | null>;
  examTemplate: ExamTemplate;
  examType: import("./examSignature").ExamSignature;
}

export const captureAndProcessImage = async (
  cv: CV,
  canvas: HTMLCanvasElement,
  detections: Detection[],
  realWidth: number = 1000,
  realHeight: number = 1520
): Promise<CaptureResult> => {
  // Identify exam type and get appropriate template
  const examType = identifyExamType(detections);
  if (!examType) {
    throw new Error("Could not identify exam type from markers");
  }
  
  const examTemplate = getExamTemplate(examType);
  
  // Validate template against exam signature
  const templateValidation = validateTemplate(examTemplate, examType);
  if (!templateValidation.isValid) {
    console.error("Template validation failed:", templateValidation.errors);
    throw new Error(`Template validation failed: ${templateValidation.errors.join(', ')}`);
  }
  
  if (templateValidation.warnings.length > 0) {
    console.warn("Template validation warnings:", templateValidation.warnings);
  }
  
  // Log template summary
  const templateSummary = getTemplateSummary(examTemplate);
  console.log("📋 Using exam template:", {
    examType: examType.name,
    templateSummary,
    validation: templateValidation
  });
  const src = cv.imread(canvas);

  // Organize the 6 markers into a grid
  const grid = organizeMarkers(detections);
  if (!grid) {
    src.delete();
    throw new Error("Could not organize markers into 2x3 grid");
  }

  const outputW = realWidth;
  const outputH = realHeight;

  // Apply piecewise transformation in 2 chunks
  const dstTop = applyPiecewiseTransformation(
    cv,
    src,
    {
      topLeft: grid.topLeft,
      topRight: grid.topRight,
      bottomLeft: grid.centerLeft,
      bottomRight: grid.centerRight,
    },
    outputW,
    outputH / 2
  );

  const dstBottom = applyPiecewiseTransformation(
    cv,
    src,
    {
      topLeft: grid.centerLeft,
      topRight: grid.centerRight,
      bottomLeft: grid.bottomLeft,
      bottomRight: grid.bottomRight,
    },
    outputW,
    outputH / 2
  );

  // Concatenate top and bottom halves vertically
  const rawPageMat = new cv.Mat();
  const matVector = new cv.MatVector();
  matVector.push_back(dstTop);
  matVector.push_back(dstBottom);
  cv.vconcat(matVector, rawPageMat);
  matVector.delete();

  // Create original image data URL
  const offscreen = document.createElement("canvas");
  offscreen.width = outputW;
  offscreen.height = outputH;
  cv.imshow(offscreen, rawPageMat);
  const originalDataURL = offscreen.toDataURL("image/png");

  // Preprocess for OCR
  const processedPageMat = preprocessForMorphology(cv, rawPageMat);
  const examResults = await scoreExam(cv, processedPageMat, examTemplate);

  console.log("Exam results:", examResults);
  const personalInfoPromise = readPersonalInfo(cv, rawPageMat, examTemplate);

  // Convert processed image to PNG for OCR/tesseract.js
  const postCanvas = document.createElement("canvas");
  postCanvas.width = processedPageMat.cols;
  postCanvas.height = processedPageMat.rows;
  cv.imshow(postCanvas, processedPageMat);
  // document.body.appendChild(postCanvas);
  const processedDataURL = postCanvas.toDataURL("image/png");
  // console.log(`processedDataURL ${processedDataURL}`);

  // Cleanup
  rawPageMat.delete();
  src.delete();
  dstTop.delete();
  dstBottom.delete();
  processedPageMat.delete();

  return {
    originalDataURL,
    processedDataURL,
    examResults,
    personalInfoPromise,
    examTemplate,
    examType,
  };
};
