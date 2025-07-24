import { CV, Mat } from "@techstark/opencv-js";

// Normalized normalization utility similar to omrchecker
const normalizeImage = (
  cv: CV,
  img: Mat,
  alpha: number = 0,
  beta: number = 255
): Mat => {
  const normalized = new cv.Mat();
  cv.normalize(img, normalized, alpha, beta, cv.NORM_MINMAX);
  return normalized;
};

// Gamma correction utility similar to omrchecker
const adjustGamma = (cv: CV, image: Mat, gamma: number = 1.0): Mat => {
  const invGamma = 1.0 / gamma;
  const lut = new cv.Mat();
  lut.create(1, 256, cv.CV_8U);

  // Build lookup table for gamma correction
  for (let i = 0; i < 256; i++) {
    lut.data[i] = Math.min(255, Math.pow(i / 255.0, invGamma) * 255);
  }

  const result = new cv.Mat();
  cv.LUT(image, lut, result);
  lut.delete();

  return result;
};

export const preprocessForOCR = (cv: CV, src: Mat): Mat => {
  // 1) Convert to grayscale
  const gray = new cv.Mat();
  if (src.channels() === 4) cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  else if (src.channels() === 3) cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);
  else src.copyTo(gray);

  // 2) Initial normalization (similar to omrchecker)
  const normalized = normalizeImage(cv, gray);
  gray.delete();

  // 3) Apply CLAHE with omrchecker's parameters (clipLimit=5.0, tileGridSize=(8,8))
  const equalized = new cv.Mat();
  const clahe = new cv.CLAHE(5.0, new cv.Size(8, 8));
  clahe.apply(normalized, equalized);
  clahe.delete();

  // 4) Apply gamma correction for shadow removal (similar to omrchecker's GAMMA_LOW)
  const gammaAdjusted = adjustGamma(cv, equalized, 0.8); // Lower gamma to make shadows darker
  equalized.delete();

  // 5) Truncate high values to remove bright spots (similar to omrchecker's threshold truncation)
  const truncated = new cv.Mat();
  cv.threshold(gammaAdjusted, truncated, 220, 220, cv.THRESH_TRUNC);
  gammaAdjusted.delete();

  // 6) Final normalization to ensure full dynamic range
  const finalNormalized = normalizeImage(cv, truncated);
  truncated.delete();
  normalized.delete();

  return finalNormalized;
};

// Alternative preprocessing function that closely mimics omrchecker's morphological preprocessing
export const preprocessForMorphology = (cv: CV, src: Mat): Mat => {
  // 1) Convert to grayscale
  const gray = new cv.Mat();
  if (src.channels() === 4) cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  else if (src.channels() === 3) cv.cvtColor(src, gray, cv.COLOR_BGR2GRAY);
  else src.copyTo(gray);

  // 2) Initial normalization
  const normalized = normalizeImage(cv, gray);
  gray.delete();

  // 3) Apply CLAHE (good for morphology as per omrchecker comment)
  const equalized = new cv.Mat();
  const clahe = new cv.CLAHE(5.0, new cv.Size(8, 8));
  clahe.apply(normalized, equalized);
  clahe.delete();

  // 4) Remove shadows further, make columns/boxes darker (less gamma)
  const gammaAdjusted = adjustGamma(cv, equalized, 0.7); // Even lower gamma for morphology
  equalized.delete();

  // 5) Threshold truncation
  const truncated = new cv.Mat();
  cv.threshold(gammaAdjusted, truncated, 220, 220, cv.THRESH_TRUNC);
  gammaAdjusted.delete();

  // 6) Final normalization
  const finalResult = normalizeImage(cv, truncated);
  truncated.delete();
  normalized.delete();

  return finalResult;
};
