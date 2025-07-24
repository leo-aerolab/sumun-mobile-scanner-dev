import * as tf from "@tensorflow/tfjs";
import { CV, Mat } from "@techstark/opencv-js";
import { ExamTemplate } from "./types";

const IMAGE_HEIGHT = 28;
const IMAGE_WIDTH = 28;

// Path for the pre‑trained model. DO NOT CHANGE THIS PATH.
const MNIST_MODEL_PATH = "/tensorflow/mnist-model.json";

// Character mapping for 62-class model (digits + uppercase + lowercase)
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

class HandwrittenCharacterOCR {
  private model: tf.LayersModel | null = null;
  private isLoaded = false;

  constructor() {
    this.loadModel();
  }

  private async loadModel() {
    try {
      console.log("=== LOADING TENSORFLOW MODEL ===");
      console.log(`Attempting to load model from: ${MNIST_MODEL_PATH}`);

      // The model is a 62-class alphanumeric recognition model
      this.model = await tf.loadLayersModel(MNIST_MODEL_PATH);
      this.isLoaded = true;

      console.log("✅ Handwritten character model loaded successfully");
      this.model.summary();
    } catch (error) {
      console.error("❌ Failed to load handwritten character model:", error);
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
      throw new Error("Model not loaded");
    }

    // Model expects [batch, 28, 28, 1] with inverted colors (white strokes → 1)
    const tensor = tf.browser
      .fromPixels(imageData, 1) // [28,28,1]
      .cast("float32")
      .div(tf.scalar(255)); // 0-1
    const inverted = tf.scalar(1).sub(tensor); // invert pixels
    const input = inverted.expandDims(0); // [1,28,28,1]

    // Model's last layer is softmax, so outputs probabilities directly
    const rawPrediction = this.model.predict(input) as tf.Tensor; // [1,62]
    const probabilityArray = Array.from(rawPrediction.dataSync()); // length 62

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
      `Predicted class ${predictedClassIndex}: "${character}" (confidence: ${confidence.toFixed(
        3
      )}) [type: ${type}]`
    );

    // Clean up tensors
    input.dispose();
    rawPrediction.dispose();

    return { character, confidence };
  }

  private async predictCharacter(
    canvas: HTMLCanvasElement,
    type: "number" | "uppercase" | "lowercase" | "all" = "all"
  ): Promise<string> {
    if (!this.model || !this.isLoaded) {
      throw new Error("Model not loaded");
    }

    // Get image data from canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    const imageData = ctx.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    try {
      const { character } = this.predict(imageData, type);
      return character;
    } catch (error) {
      console.error("Prediction error:", error);
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
let ocrInstance: HandwrittenCharacterOCR | null = null;

export const getOCRInstance = (): HandwrittenCharacterOCR => {
  if (!ocrInstance) {
    ocrInstance = new HandwrittenCharacterOCR();
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

      // Only process numeric fields with TensorFlow (handwritten digits)
      if (type !== "number") {
        info[name] = "";
        continue;
      }

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

        // Recognize character using TensorFlow
        try {
          const recognizedCharacter = await ocrInstance.recognizeDigit(
            ocrCanvas
          );
          info[name] = info[name].concat(`${recognizedCharacter}`);
          console.log(`Recognized digit: ${recognizedCharacter}`);
        } catch (error) {
          console.error(`Error recognizing character at position ${i}:`, error);
          info[name] = info[name].concat("");
        }

        //Optional: Add canvas to DOM for debugging
        ocrCanvas.style.border = "1px solid red";
        ocrCanvas.style.margin = "2px";
        // document.body.appendChild(ocrCanvas);

        // Cleanup
        charMat.delete();
      }
    }
  } catch (error) {
    console.error("Error reading personal info with TensorFlow:", error);
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
  cv.imshow(canvas, region);

  try {
    const result = await ocrInstance.recognizeCharacter(canvas, type);
    region.delete();
    return result;
  } catch (error) {
    region.delete();
    console.error("Error recognizing character region:", error);
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
  cv.imshow(canvas, region);

  try {
    const result = await ocrInstance.recognizeDigit(canvas);
    region.delete();
    return result;
  } catch (error) {
    region.delete();
    console.error("Error recognizing digit region:", error);
    return "";
  }
};
