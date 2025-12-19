import { CV, Mat } from "@techstark/opencv-js";

export type Detection = {
  id: number;
  corners: [number, number][];
  center: [number, number];
};

export type MarkerGrid = {
  topLeft: Detection;
  topRight: Detection;
  centerLeft: Detection;
  centerRight: Detection;
  bottomLeft: Detection;
  bottomRight: Detection;
};

export type SimpleMarkerGrid = {
  topLeft: Detection;
  topRight: Detection;
  bottomLeft: Detection;
  bottomRight: Detection;
};

/**
 * Helper function to organize 6 markers into a 3x2 grid
 */
export const organizeMarkers = (markers: Detection[]): MarkerGrid | null => {
  if (markers.length !== 6) return null;

  // Sort markers by Y coordinate first (top to bottom), then by X (left to right)
  const sorted = [...markers].sort((a, b) => {
    const yDiff = a.center[1] - b.center[1];
    if (Math.abs(yDiff) > 50) return yDiff; // Different rows
    return a.center[0] - b.center[0]; // Same row, sort by X
  });

  // Split into three rows (assuming 3x2 grid)
  const minY = Math.min(...sorted.map((m) => m.center[1]));
  const maxY = Math.max(...sorted.map((m) => m.center[1]));
  const rowHeight = (maxY - minY) / 2;

  const topRow = sorted
    .filter((m) => m.center[1] < minY + rowHeight * 0.5)
    .sort((a, b) => a.center[0] - b.center[0]);
  const centerRow = sorted
    .filter(
      (m) =>
        m.center[1] >= minY + rowHeight * 0.5 &&
        m.center[1] < minY + rowHeight * 1.5
    )
    .sort((a, b) => a.center[0] - b.center[0]);
  const bottomRow = sorted
    .filter((m) => m.center[1] >= minY + rowHeight * 1.5)
    .sort((a, b) => a.center[0] - b.center[0]);

  if (topRow.length !== 2 || centerRow.length !== 2 || bottomRow.length !== 2)
    return null;

  return {
    topLeft: topRow[0],
    topRight: topRow[1],
    centerLeft: centerRow[0],
    centerRight: centerRow[1],
    bottomLeft: bottomRow[0],
    bottomRight: bottomRow[1],
  };
};

/**
 * Simplified transformation for 6 markers using perspective transform
 */
export const applyPiecewiseTransformation = (
  cv: CV,
  src: Mat,
  grid: SimpleMarkerGrid,
  outputW: number,
  outputH: number
) => {
  try {
    // Use a simpler approach: apply perspective transform to each quadrant
    const dst = new (cv as any).Mat.zeros(
      outputH,
      outputW,
      (cv as any).CV_8UC3
    );

    // Define the 4 corner points of the entire document
    // TODO: We should include the markers in the final image, not just the centers
    const srcCorners = [
      grid.topLeft.center,
      grid.topRight.center,
      grid.bottomRight.center,
      grid.bottomLeft.center,
    ];

    const dstCorners = [
      [0, 0],
      [outputW, 0],
      [outputW, outputH],
      [0, outputH],
    ];

    // Create source and destination point matrices
    const srcPts = (cv as any).matFromArray(
      4,
      1,
      (cv as any).CV_32FC2,
      new Float32Array(srcCorners.flat())
    );
    const dstPts = (cv as any).matFromArray(
      4,
      1,
      (cv as any).CV_32FC2,
      new Float32Array(dstCorners.flat())
    );

    // Get perspective transformation matrix
    const perspectiveMatrix = (cv as any).getPerspectiveTransform(
      srcPts,
      dstPts
    );

    // Apply perspective transformation
    (cv as any).warpPerspective(
      src,
      dst,
      perspectiveMatrix,
      new (cv as any).Size(outputW, outputH)
    );

    // Cleanup
    srcPts.delete();
    dstPts.delete();
    perspectiveMatrix.delete();

    return dst;
  } catch (error) {
    console.error("Error in perspective transformation:", error);
    // Return a simple copy if transformation fails
    const dst = new (cv as any).Mat();
    (cv as any).resize(src, dst, new (cv as any).Size(outputW, outputH));
    return dst;
  }
};

/**
 * Initialize ArUco detector with default parameters
 */
export const initializeArucoDetector = (cv: CV) => {
  try {
    const dict = (cv as any).getPredefinedDictionary(
      (cv as any).aruco_DICT_4X4_50
    );
    const params = new (cv as any).aruco_DetectorParameters();
    const refineParams = new (cv as any).aruco_RefineParameters(10, 3, true);
    const detector = new (cv as any).aruco_ArucoDetector(
      dict,
      params,
      refineParams
    );
    const cornersVec = new (cv as any).MatVector();
    const idsMat = new (cv as any).Mat();

    return { dict, params, refineParams, detector, cornersVec, idsMat };
  } catch (error) {
    console.error("Failed to initialize ArUco detector:", error);
    return null;
  }
};

/**
 * Detect ArUco markers in a grayscale image
 */
export const detectArucoMarkers = (
  cv: CV,
  detector: any,
  cornersVec: any,
  idsMat: any,
  grayImage: Mat
): Detection[] => {
  try {
    // detectMarkers will clear and repopulate these objects
    detector.detectMarkers(grayImage, cornersVec, idsMat);

    const detections: Detection[] = [];
    // Check if we have valid detection results
    if (idsMat.rows > 0 && cornersVec.size() > 0) {
      for (let i = 0; i < Math.min(idsMat.rows, cornersVec.size()); i++) {
        const id = idsMat.data32S[i];
        const mat = cornersVec.get(i);
        const corners: [number, number][] = [];
        for (let j = 0; j < 4; j++) {
          corners.push([mat.data32F[j * 2], mat.data32F[j * 2 + 1]]);
        }
        const cx =
          (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
        const cy =
          (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
        detections.push({ id, corners, center: [cx, cy] });
      }
    }

    return detections;
  } catch (error) {
    console.error("Error detecting ArUco markers:", error);
    return [];
  }
};

/**
 * Scale detection coordinates by a factor (for adaptive resolution)
 */
export const scaleDetections = (
  detections: Detection[],
  scaleFactor: number
): Detection[] => {
  return detections.map((det) => ({
    id: det.id,
    corners: det.corners.map(([x, y]) => [
      x * scaleFactor,
      y * scaleFactor,
    ]) as [number, number][],
    center: [det.center[0] * scaleFactor, det.center[1] * scaleFactor],
  }));
};

/**
 * Clean up ArUco detector resources
 */
export const cleanupArucoDetector = (detectorObjects: {
  dict?: any;
  params?: any;
  refineParams?: any;
  detector?: any;
  cornersVec?: any;
  idsMat?: any;
}) => {
  try {
    if (detectorObjects.cornersVec?.delete) detectorObjects.cornersVec.delete();
    if (detectorObjects.idsMat?.delete) detectorObjects.idsMat.delete();
    if (detectorObjects.detector?.delete) detectorObjects.detector.delete();
    if (detectorObjects.params?.delete) detectorObjects.params.delete();
    if (detectorObjects.dict?.delete) detectorObjects.dict.delete();
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};
