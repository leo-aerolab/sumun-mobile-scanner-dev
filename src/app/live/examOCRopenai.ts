import { CV, Mat } from "@techstark/opencv-js";
import { ExamTemplate, ExamStudent } from "./types";
import { ExamPersonalInfoType } from "../api/vision/libs";

/**
 * Main function to read personal info from exam image using OpenAI Vision
 */
export const readPersonalInfo = async (
  cv: CV,
  matGray: Mat,
  template: ExamTemplate,
  students?: ExamStudent[]
): Promise<ExamPersonalInfoType | null> => {
  try {
    const visionMat = matGray.roi(
      new cv.Rect(
        template.visionBlock.left,
        template.visionBlock.top,
        template.visionBlock.width,
        template.visionBlock.height
      )
    );

    const visionCanvas = document.createElement("canvas");
    visionCanvas.width = visionMat.cols;
    visionCanvas.height = visionMat.rows;
    cv.imshow(visionCanvas, visionMat);

    // Convert canvas to base64 jpg
    const base64Image = visionCanvas.toDataURL("image/jpeg", 0.8);
    console.log("base64Image", base64Image);

    const req = await fetch("/api/vision", {
      method: "POST",
      body: JSON.stringify({
        image: base64Image,
        students,
      }),
    });

    return req.json();
  } catch (error) {
    console.error(
      "❌ Error extracting personal info with OpenAI Vision:",
      error
    );

    return null;
  }
};
