import { CV, Mat } from "@techstark/opencv-js";
import Tesseract, { Worker } from "tesseract.js";
import { ExamTemplate } from "./types";

export const readPersonalInfo = async (
  cv: CV,
  worker: Worker,
  matGray: Mat,
  template: ExamTemplate
) => {
  const info: Record<string, string> = {};

  try {
    for (const block of template.readBlocks) {
      const { name, top, left, width, height, type, numCharacters } = block;

      info[name] = "";

      for (let i = 0; i < numCharacters; i++) {
        const charWidth = width / numCharacters;
        const charHeight = height;
        const charMat = matGray.roi(
          new cv.Rect(left + i * charWidth, top, charWidth, charHeight)
        );

        // Mat → canvas → data-URL
        const ocrCanvas = document.createElement("canvas");
        cv.imshow(ocrCanvas, charMat);
        ocrCanvas.width = charWidth;
        ocrCanvas.height = charHeight;
        const png = ocrCanvas.toDataURL("image/png");

        // document.body.appendChild(ocrCanvas);

        await worker.setParameters({
          tessedit_char_whitelist:
            type === "name" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "0123456789",
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR,
        });

        const ocrResult = await worker.recognize(png);

        info[name] +=
          ocrResult.data.text.trim() !== "" ? ocrResult.data.text.trim() : "";

        // housekeeping
        charMat.delete();
      }
    }
  } catch (error) {
    console.error("Error reading personal info:", error);
  }

  return info;
};
