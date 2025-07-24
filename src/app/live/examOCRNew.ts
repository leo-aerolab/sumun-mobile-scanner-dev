import * as tf from "@tensorflow/tfjs";
import { CV, Mat } from "@techstark/opencv-js";
import { ExamTemplate } from "./types";

// Uses this model https://github.com/PuravG/EMNIST-Classifier/blob/main/tensorflowjs.js

const IMAGE_HEIGHT = 28;
const IMAGE_WIDTH = 28;

// Path for the EMNIST pre‑trained model
const EMNIST_MODEL_PATH = "/tensorflow/emnist/model.json";

// Character mapping for 62-class EMNIST model (digits + uppercase + lowercase)
const createCharacterMapping = (): string[] => {
  const chars: string[] = [];

  // Digits 0-9 (classes 0-9)
  for (let i = 0; i <= 9; i++) {
    chars.push(i.toString());
  }

  // Uppercase A-Z (classes 10-35)
  for (let i = 0; i < 26; i++) {
    chars.push(String.fromCharCode(65 + i)); // A-Z
  }

  // Lowercase a-z (classes 36-61)
  for (let i = 0; i < 26; i++) {
    chars.push(String.fromCharCode(97 + i)); // a-z
  }

  return chars;
};

const CHARACTER_MAP = createCharacterMapping();

class HandwrittenCharacterOCREMNIST {
  private model: tf.LayersModel | null = null;
  private isLoaded = false;

  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    try {
      console.log("=== LOADING EMNIST TENSORFLOW MODEL ===");
      console.log(`Attempting to load EMNIST model from: ${EMNIST_MODEL_PATH}`);

      // The model is a 62-class alphanumeric recognition model (EMNIST)
      this.model = await tf.loadLayersModel(EMNIST_MODEL_PATH);
      this.isLoaded = true;

      console.log("✅ EMNIST handwritten character model loaded successfully");
      this.model.summary();
    } catch (error) {
      console.error(
        "❌ Failed to load EMNIST handwritten character model:",
        error
      );
      throw error;
    }
  }

  private predict(
    imageData: ImageData,
    type: "number" | "uppercase" | "lowercase" | "all" = "all"
  ): {
    character: string;
    confidence: number;
  } {
    if (!this.model || !this.isLoaded) {
      throw new Error("EMNIST Model not loaded");
    }

    //resizing the input image to target size of (1, 28, 28)
    //tf.browser.fromPixels() method, to create a tensor that will flow into the first layer of the model
    //tf.image.resizeNearestNeighbor() function resizes a batch of 3D images to a new shape
    //tf.mean() function is used to compute the mean of elements across the dimensions of the tensor
    //tf.toFloat() function casts the array to type float
    //The tensor.div() function is used to divide the array or tensor by the maximum RGB value(255)
    const tensor = tf.browser
      .fromPixels(imageData, 1) // [28,28,1] - grayscale
      .resizeNearestNeighbor([IMAGE_HEIGHT, IMAGE_WIDTH]) // [28,28,1]
      .mean(2)
      .expandDims(2)
      .expandDims()
      .toFloat()
      .div(255.0);

    // Model's last layer should output probabilities
    const rawPrediction = this.model.predict(tensor) as tf.Tensor;
    const probabilityArray = Array.from(rawPrediction.dataSync());

    // Define character type ranges
    const getValidIndices = (type: string): number[] => {
      switch (type) {
        case "number":
          return Array.from({ length: 10 }, (_, i) => i); // 0-9
        case "uppercase":
          return Array.from({ length: 26 }, (_, i) => i + 10); // 10-35
        case "lowercase":
          return Array.from({ length: 26 }, (_, i) => i + 36); // 36-61
        case "all":
        default:
          return Array.from({ length: 62 }, (_, i) => i); // 0-61
      }
    };

    const validIndices = getValidIndices(type);

    // Find the highest probability among valid character types
    let maxProbability = -1;
    let predictedClassIndex = -1;

    for (const index of validIndices) {
      if (probabilityArray[index] > maxProbability) {
        maxProbability = probabilityArray[index];
        predictedClassIndex = index;
      }
    }

    const character = CHARACTER_MAP[predictedClassIndex] || "";
    const confidence = maxProbability;

    console.log(
      `EMNIST Predicted class ${predictedClassIndex}: "${character}" (confidence: ${confidence.toFixed(
        3
      )}) [type: ${type}]`
    );

    // Clean up tensors
    tensor.dispose();
    rawPrediction.dispose();

    return { character, confidence };
  }

  private async predictCharacter(
    canvas: HTMLCanvasElement,
    type: "number" | "uppercase" | "lowercase" | "all" = "all"
  ): Promise<string> {
    if (!this.model || !this.isLoaded) {
      throw new Error("EMNIST Model not loaded");
    }

    // Get image data from canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      const { character } = this.predict(imageData, type);
      return character;
    } catch (error) {
      console.error("EMNIST Prediction error:", error);
      return "";
    }
  }

  async waitForModel(): Promise<void> {
    while (!this.isLoaded) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async recognizeCharacter(
    canvas: HTMLCanvasElement,
    type: "number" | "uppercase" | "lowercase" | "all" = "all"
  ): Promise<string> {
    await this.waitForModel();
    return this.predictCharacter(canvas, type);
  }

  async recognizeDigit(canvas: HTMLCanvasElement): Promise<string> {
    await this.waitForModel();
    // Use the number type to restrict predictions to digits only
    return this.predictCharacter(canvas, "number");
  }
}

// Global instance
let ocrInstance: HandwrittenCharacterOCREMNIST | null = null;

export const getOCRInstance = (): HandwrittenCharacterOCREMNIST => {
  if (!ocrInstance) {
    ocrInstance = new HandwrittenCharacterOCREMNIST();
  }
  return ocrInstance;
};

export const readPersonalInfo = async (
  cv: CV,
  matGray: Mat,
  template: ExamTemplate
) => {
  const info: Record<string, string> = {};
  const ocrInstance = getOCRInstance();

  try {
    for (const block of template.readBlocks) {
      const { name, top, left, width, height, type, numCharacters } = block;

      // Process all character types with EMNIST
      info[name] = "";

      for (let i = 0; i < numCharacters; i++) {
        const charWidth = Math.floor(width / numCharacters);
        const charHeight = Math.floor(height);
        const charMat = matGray.roi(
          new cv.Rect(left + i * charWidth, top, charWidth, charHeight)
        );

        // Convert Mat to canvas
        const ocrCanvas = document.createElement("canvas");
        ocrCanvas.width = charWidth;
        ocrCanvas.height = charHeight;
        cv.imshow(ocrCanvas, charMat);

        // Recognize character using EMNIST TensorFlow
        try {
          let recognizedCharacter: string;
          if (type === "number") {
            recognizedCharacter = await ocrInstance.recognizeDigit(ocrCanvas);
          } else {
            recognizedCharacter = await ocrInstance.recognizeCharacter(
              ocrCanvas,
              type as "number" | "uppercase" | "lowercase" | "all"
            );
          }
          info[name] = info[name].concat(`${recognizedCharacter}`);
          console.log(`EMNIST Recognized character: ${recognizedCharacter}`);
        } catch (error) {
          console.error(`Error recognizing character at position ${i}:`, error);
          info[name] = info[name].concat("");
        }

        // Cleanup
        charMat.delete();
      }
    }
  } catch (error) {
    console.error("Error reading personal info with EMNIST TensorFlow:", error);
  }

  return info;
};

// Additional utility function for batch processing
export const recognizeCharacterRegion = async (
  cv: CV,
  matGray: Mat,
  x: number,
  y: number,
  width: number,
  height: number,
  type: "number" | "uppercase" | "lowercase" | "all" = "all"
): Promise<string> => {
  const ocrInstance = getOCRInstance();

  const region = matGray.roi(new cv.Rect(x, y, width, height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  cv.imshow(canvas, region);

  try {
    const result = await ocrInstance.recognizeCharacter(canvas, type);
    region.delete();
    return result;
  } catch (error) {
    region.delete();
    console.error("Error recognizing character region with EMNIST:", error);
    return "";
  }
};

export const recognizeDigitRegion = async (
  cv: CV,
  matGray: Mat,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<string> => {
  const ocrInstance = getOCRInstance();

  const region = matGray.roi(new cv.Rect(x, y, width, height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  cv.imshow(canvas, region);

  try {
    const result = await ocrInstance.recognizeDigit(canvas);
    region.delete();
    return result;
  } catch (error) {
    region.delete();
    console.error("Error recognizing digit region with EMNIST:", error);
    return "";
  }
};
