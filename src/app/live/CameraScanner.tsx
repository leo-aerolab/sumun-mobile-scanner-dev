"use client";

import cvReadyPromise, { CV } from "@techstark/opencv-js";
import React, { useEffect, useRef, useState } from "react";
import CameraControls from "./CameraControls";
import CameraOverlay from "./CameraOverlay";
import ExamResultsModal from "./ExamResultsModal";
import { captureAndProcessImage } from "./imageCapture";
import {
  cleanupArucoDetector,
  detectArucoMarkers,
  Detection,
  initializeArucoDetector,
} from "./markerDetection";
import { playSuccess } from "./soundUtils";
import {
  identifyExamType,
  validateExamSignature,
  visualizeMarkerLayout,
  ExamSignature,
} from "./examSignature";

// Import the new types from examScoring
import { ExamPersonalInfoType } from "../api/vision/libs";
import { ExamResult } from "./examScoring";
import { getExamTemplate } from "./examTemplateManager";
import { ExamConfig } from "./types";
import { getExamConfig, validateExamConfig } from "./examConfigs";

function sendMessageToWebView(type: string, data: any) {
  console.log("Sending message to webview:", type, data);

  if (window.ReactNativeWebView) {
    const message = {
      type,
      ...data,
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
}

function getInjectedObject(): ExamConfig | null {
  if (window.ReactNativeWebView) {
    try {
      const injectedObject = window.ReactNativeWebView.injectedObjectJson();
      if (!injectedObject) {
        return null;
      }

      const parsed = JSON.parse(injectedObject);
      if (!parsed.examConfig) {
        return null;
      }

      return parsed.examConfig;
    } catch (error) {
      console.error("📱 Error parsing injected object:", error);
      return null;
    }
  }
  return null;
}

export const CameraScanner: React.FC = () => {
  const opencvRef = useRef<CV>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const realWidth = 1000;
  const realHeight = 1520;
  const [examResults, setExamResults] = useState<ExamResult | null>(null);
  const [personalInfo, setPersonalInfo] = useState<ExamPersonalInfoType | null>(
    null
  );
  const [capturedImage, setCapturedImage] = useState<{
    canvasDataURL: string;
    fieldBlocksImage: string;
    illegibleRowImages?: { [questionName: string]: string };
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [isMobile, setIsMobile] = useState(false);
  const [currentExamType, setCurrentExamType] = useState<ExamSignature | null>(
    null
  );
  const [isWebView, setIsWebView] = useState(false);
  const [examTypeMismatchError, setExamTypeMismatchError] = useState<string | null>(null);

  // Refs for immediate state tracking to avoid closure stale state
  const isProcessingRef = useRef(false);
  const examResultsRef = useRef<ExamResult | null>(null);
  const isDetectionActiveRef = useRef(true);
  const facingModeRef = useRef<"user" | "environment">("environment");
  const examConfigRef = useRef<ExamConfig | null>(null);

  // Load exam config on component mount
  useEffect(() => {
    const loadExamConfig = () => {
      // Try to get exam config from injected object (webview) first
      const injectedConfig = getInjectedObject();

      if (injectedConfig) {
        alert(JSON.stringify(injectedConfig));
        examConfigRef.current = injectedConfig;
      } else {
        const examConfigId = "mock-microtest-local";
        // Fallback to mock config
        const config = getExamConfig(examConfigId);
        if (!config) {
          console.error(`Exam config not found: ${examConfigId}`);
          return;
        }

        examConfigRef.current = config;
      }
    };

    // Load config immediately
    loadExamConfig();
  }, []);

  // Function to generate field blocks image from originalDataURL
  const generateFieldBlocksImage = async (
    originalDataURL: string,
    examType: any
  ): Promise<string> => {
    // Create a new canvas for the field blocks image
    const fieldBlocksCanvas = document.createElement("canvas");
    const fieldBlocksCtx = fieldBlocksCanvas.getContext("2d");
    if (!fieldBlocksCtx) return "";

    // Get the exam template
    const template = getExamTemplate(examType);

    // Calculate the bounding box of all field blocks
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    template.fieldBlocks.forEach((block) => {
      minLeft = Math.min(minLeft, block.left);
      minTop = Math.min(minTop, block.top);
      maxRight = Math.max(maxRight, block.left + block.width);
      maxBottom = Math.max(maxBottom, block.top + block.height);
    });

    // Extend the bounding box by 50px to the left and top to include surrounding content
    const paddingLeft = 90;
    const paddingTop = 70;
    const extraPadding = 20;
    const extendedMinLeft = Math.max(0, minLeft - paddingLeft - extraPadding);
    const extendedMinTop = Math.max(0, minTop - paddingTop - extraPadding);
    const extendedMaxRight = maxRight + extraPadding;
    const extendedMaxBottom = maxBottom + extraPadding;

    // Set canvas size to match the extended bounding box
    const fieldBlocksWidth = extendedMaxRight - extendedMinLeft;
    const fieldBlocksHeight = extendedMaxBottom - extendedMinTop;
    fieldBlocksCanvas.width = fieldBlocksWidth;
    fieldBlocksCanvas.height = fieldBlocksHeight;

    // Create an image from the originalDataURL
    const originalImage = new Image();
    originalImage.crossOrigin = "anonymous";

    return new Promise<string>((resolve) => {
      originalImage.onload = () => {
        // Draw the extended region from the original image
        fieldBlocksCtx.drawImage(
          originalImage,
          extendedMinLeft,
          extendedMinTop,
          fieldBlocksWidth,
          fieldBlocksHeight,
          0,
          0,
          fieldBlocksWidth,
          fieldBlocksHeight
        );

        resolve(fieldBlocksCanvas.toDataURL("image/png"));
      };

      originalImage.src = originalDataURL;
    });
  };

  // Function to generate row images for questions (illegible by default, or all if specified)
  const generateQuestionRowImages = async (
    fieldBlocksImageDataURL: string,
    examResults: ExamResult,
    examType: any,
    includeAllQuestions: boolean = false
  ): Promise<{ [questionName: string]: string }> => {
    const template = getExamTemplate(examType);
    const rowImages: { [questionName: string]: string } = {};

    // Create an image from the fieldBlocksImageDataURL
    const fieldBlocksImage = new Image();
    fieldBlocksImage.crossOrigin = "anonymous";

    return new Promise<{ [questionName: string]: string }>((resolve) => {
      fieldBlocksImage.onload = () => {
        // Calculate the bounding box used for fieldBlocks image (same logic as generateFieldBlocksImage)
        let minLeft = Infinity;
        let minTop = Infinity;
        let maxRight = -Infinity;
        let maxBottom = -Infinity;

        template.fieldBlocks.forEach((block) => {
          minLeft = Math.min(minLeft, block.left);
          minTop = Math.min(minTop, block.top);
          maxRight = Math.max(maxRight, block.left + block.width);
          maxBottom = Math.max(maxBottom, block.top + block.height);
        });

        const paddingLeft = 90;
        const paddingTop = 70;
        const extraPadding = 20;
        const extendedMinLeft = Math.max(
          0,
          minLeft - paddingLeft - extraPadding
        );
        const extendedMinTop = Math.max(0, minTop - paddingTop - extraPadding);

        // Process each question
        let questionIndex = 0;

        for (const block of template.fieldBlocks) {
          const { top, left, width, height, numQuestions, gapY } = block;

          // Calculate row height
          const cellH =
            (height - (gapY || 0) * (numQuestions - 1)) / numQuestions;

          for (let q = 0; q < numQuestions; q++) {
            const questionResult = examResults.questions[questionIndex];

            // Check if this question should be included
            // Only include illegible answers (low confidence or "?"), not incomplete/empty answers
            const isIllegible =
              questionResult &&
              ((questionResult.confidence > 0 &&
                questionResult.confidence < 0.3) ||
                questionResult.selectedAnswer === "?");

            const shouldInclude = includeAllQuestions || isIllegible;

            if (shouldInclude && questionResult) {
              // Calculate row position in original image coordinates
              const rowTop = top + q * cellH + q * (gapY || 0);
              const rowHeight = cellH;

              // Add some padding to the row to include context
              const rowPadding = 10;
              const adjustedRowTop = Math.max(0, rowTop - rowPadding);
              const adjustedRowHeight = rowHeight + 2 * rowPadding;

              // Convert to fieldBlocks image coordinates (relative to the cropped region)
              const rowTopInFieldBlocks = adjustedRowTop - extendedMinTop;
              const rowLeftInFieldBlocks = left - paddingLeft - extendedMinLeft;
              const rowWidthInFieldBlocks = width + paddingLeft * 2;

              // Create canvas for this row
              const rowCanvas = document.createElement("canvas");
              const rowCtx = rowCanvas.getContext("2d");

              if (
                rowCtx &&
                rowTopInFieldBlocks >= 0 &&
                rowLeftInFieldBlocks >= 0
              ) {
                rowCanvas.width = rowWidthInFieldBlocks;
                rowCanvas.height = adjustedRowHeight;

                // Extract the row from the fieldBlocks image
                rowCtx.drawImage(
                  fieldBlocksImage,
                  Math.max(0, rowLeftInFieldBlocks),
                  Math.max(0, rowTopInFieldBlocks),
                  Math.min(
                    rowWidthInFieldBlocks,
                    fieldBlocksImage.width - rowLeftInFieldBlocks
                  ),
                  Math.min(
                    adjustedRowHeight,
                    fieldBlocksImage.height - rowTopInFieldBlocks
                  ),
                  0,
                  0,
                  rowCanvas.width,
                  rowCanvas.height
                );

                // Store the row image
                rowImages[questionResult.questionName] =
                  rowCanvas.toDataURL("image/png");
                const questionType = isIllegible ? "illegible" : "readable";
                console.log(
                  `Generated row image for ${questionType} question: ${questionResult.questionName}`
                );
                console.log(rowCanvas.toDataURL("image/png"));
              }
            }

            questionIndex++;
          }
        }

        resolve(rowImages);
      };

      fieldBlocksImage.src = fieldBlocksImageDataURL;
    });
  };

  // Helper function for backward compatibility
  const generateIllegibleRowImages = async (
    fieldBlocksImageDataURL: string,
    examResults: ExamResult,
    examType: any
  ): Promise<{ [questionName: string]: string }> => {
    return generateQuestionRowImages(
      fieldBlocksImageDataURL,
      examResults,
      examType,
      false
    );
  };

  // Detect if we're in a webview
  useEffect(() => {
    console.log("WebView detected:", window.ReactNativeWebView);

    if (window.ReactNativeWebView) {
      setIsWebView(true);

      const handleCloseModalEvent = (event: Event) => {
        console.log("event received: closemodal", event);
        handleCloseModal();
      };

      const handleSwitchCameraEvent = (event: Event) => {
        console.log("event received: switchcamera", event);
        switchCamera();
      };

      const handleStopCameraEvent = (event: Event) => {
        console.log("event received: stopcamera", event);
        stopCamera();
      };

      const handleStartCameraEvent = (event: Event) => {
        console.log("event received: startcamera", event);
        startCamera(facingMode);
      };

      window.addEventListener("closemodal", handleCloseModalEvent);
      window.addEventListener("switchcamera", handleSwitchCameraEvent);
      window.addEventListener("stopcamera", handleStopCameraEvent);
      window.addEventListener("startcamera", handleStartCameraEvent);

      return () => {
        window.removeEventListener("closemodal", handleCloseModalEvent);
        window.removeEventListener("switchcamera", handleSwitchCameraEvent);
        window.removeEventListener("stopcamera", handleStopCameraEvent);
        window.removeEventListener("startcamera", handleStartCameraEvent);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent.toLowerCase()
        );
      setIsMobile(isMobileDevice);
    };

    checkIfMobile();
  }, []);

  // Load OpenCV.js dynamically
  useEffect(() => {
    const loadOpenCV = async () => {
      try {
        const cvInstance = await cvReadyPromise;
        console.debug(cvInstance.getBuildInformation());
        opencvRef.current = cvInstance;
        setupDetection();
      } catch (error) {
        console.error("Failed to load OpenCV:", error);
      }
    };

    loadOpenCV();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to wait for video to be ready before playing
  const waitForVideoReady = async (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const video = videoRef.current;
      if (!video) {
        reject(new Error("Video element not available"));
        return;
      }

      const handleCanPlay = () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
        clearTimeout(timeoutId);
        resolve();
      };

      const handleError = () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
        clearTimeout(timeoutId);
        reject(new Error("Video error"));
      };

      const timeoutId = setTimeout(() => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
        reject(new Error("Video load timeout"));
      }, 5000);

      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);
    });
  };

  // Function to start camera with specific facing mode
  const startCamera = async (facing: "user" | "environment") => {
    if (!videoRef.current) return;

    // Stop current stream if it exists and wait for it to fully stop
    if (videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;

      // Wait a bit for the stream to fully stop before starting a new one
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for the video to be ready before attempting to play
        await waitForVideoReady();

        // Now safely play the video
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn("Video play interrupted:", playError);
        }
      }
    } catch (error) {
      console.error("Camera access error:", error);
      // Try fallback without specific facing mode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;

          // Wait for the video to be ready before attempting to play
          await waitForVideoReady();

          // Now safely play the video
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.warn("Fallback video play interrupted:", playError);
          }
        }
      } catch (fallbackError) {
        console.error("Fallback camera access error:", fallbackError);
      }
    }
  };

  // Function to switch cameras
  const switchCamera = async () => {
    const newFacingMode =
      facingModeRef.current === "environment" ? "user" : "environment";
    facingModeRef.current = newFacingMode;
    setFacingMode(newFacingMode);
    await startCamera(newFacingMode);
  };

  // Keep facingModeRef in sync with facingMode state
  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  // Request camera access
  useEffect(() => {
    startCamera(facingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Detection loop using ArUco
  const setupDetection = () => {
    if (!opencvRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let rafId: number;
    let isDetecting = false;

    // Initialize ArUco detector using helper function
    const detectorObjects = initializeArucoDetector(opencvRef.current);
    if (!detectorObjects) {
      console.error("Failed to initialize ArUco detector");
      return;
    }

    const { detector, cornersVec, idsMat } = detectorObjects;

    const detect = () => {
      if (isDetecting || !opencvRef.current) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      // Stop detection completely when inactive, processing, or showing results
      // Use refs to avoid stale closure values
      if (
        !isDetectionActiveRef.current ||
        isProcessingRef.current ||
        examResultsRef.current
      ) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      isDetecting = true;

      let src: any = null;
      let gray: any = null;

      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Check if all required objects are valid
          if (!detector || !cornersVec || !idsMat) {
            console.error("OpenCV objects not properly initialized");
            return;
          }

          src = opencvRef.current.imread(canvas);
          if (!src || src.empty()) {
            console.error("Failed to read image from canvas");
            return;
          }

          gray = new opencvRef.current.Mat();
          opencvRef.current.cvtColor(
            src,
            gray,
            opencvRef.current.COLOR_RGBA2GRAY
          );

          // Detect ArUco markers using helper function
          const dets = detectArucoMarkers(
            opencvRef.current,
            detector,
            cornersVec,
            idsMat,
            gray
          );

          setDetections(dets);

          // Identify exam type in real-time when 6 markers are detected
          if (dets.length === 6) {
            const examType = identifyExamType(dets);
            setCurrentExamType(examType);
          } else {
            setCurrentExamType(null);
          }

          opencvRef.current.imshow(canvas, src);

          // Auto-trigger capture when 6 markers detected (only if conditions are met)
          // Use refs to avoid stale closure values
          if (
            dets.length === 6 &&
            isDetectionActiveRef.current &&
            !isProcessingRef.current &&
            !examResultsRef.current
          ) {
            handleCapture(dets);
          }
        }
      } catch (error) {
        console.error("Detection error:", error);
      } finally {
        // Always clean up Mat objects
        try {
          if (src && src.delete) src.delete();
          if (gray && gray.delete) gray.delete();
        } catch (cleanupError) {
          console.warn("Cleanup error:", cleanupError);
        }
        isDetecting = false;
        rafId = requestAnimationFrame(detect);
      }
    };

    detect();

    return () => {
      cancelAnimationFrame(rafId);
      cleanupArucoDetector(detectorObjects);
    };
  };

  // Video feed update loop (independent of OpenCV)
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let rafId: number;

    const updateVideoFeed = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Set canvas size to match video's natural dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Clear canvas and draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Only draw video feed if OpenCV is not handling it
        if (!opencvRef.current) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }
      rafId = requestAnimationFrame(updateVideoFeed);
    };

    updateVideoFeed();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleCapture = async (detections: Detection[]) => {
    if (!opencvRef.current || !canvasRef.current) return;
    if (isProcessingRef.current || examResultsRef.current) return;

    // Update refs immediately for instant state tracking
    isProcessingRef.current = true;
    isDetectionActiveRef.current = false;

    // Reset personal info when starting new capture
    setPersonalInfo(null);
    setIsProcessing(true);

    // Log ArUco marker data and identify exam type
    console.log("ArUco markers detected during successful scan:");
    detections.forEach((detection, index) => {
      console.log(`Marker ${index + 1}:`, {
        id: detection.id,
        center: detection.center,
        corners: detection.corners,
      });
    });

    // Validate and identify exam type based on marker signature
    const signatureValidation = validateExamSignature(detections);
    console.log("📝 Exam signature validation:", signatureValidation);

    if (signatureValidation.isValid && signatureValidation.examType) {
      setCurrentExamType(signatureValidation.examType);
      console.log(
        "🎯 Exam type identified:",
        signatureValidation.examType.name
      );
      console.log("📋 Exam metadata:", signatureValidation.examType.metadata);
    } else {
      console.warn("⚠️ Validation errors:", signatureValidation.errors);
      setCurrentExamType(null);
    }

    // Show visual layout of detected markers
    console.log("🎨 Marker layout visualization:");
    console.log(visualizeMarkerLayout(detections));

    try {
      const canvas = canvasRef.current;
      // Identify exam type and get appropriate config
      const detectedExamType = identifyExamType(detections);
      if (!detectedExamType) {
        throw new Error("Could not identify exam type from markers");
      }

      // Get exam config - check for injected config first, then fallback to ref
      let configToUse = examConfigRef.current;

      // Always check for injected config first (in case it was updated after component mount)
      const injectedConfig = getInjectedObject();
      if (injectedConfig) {
        configToUse = injectedConfig;
        examConfigRef.current = injectedConfig; // Update ref for consistency
      } else if (!configToUse) {
        throw new Error(
          "No exam config available. Please ensure exam config is injected from native side or use mock config for development."
        );
      }

      // Validate that detected exam type matches the expected template from config
      if (configToUse.templateId !== detectedExamType.id) {
        const errorMessage = `Wrong exam type detected! You're scanning a ${detectedExamType.name} (${detectedExamType.id}) but the app expects a ${configToUse.examName} (${configToUse.templateId}). Please scan the correct exam.`;
        console.error(errorMessage);
        setExamTypeMismatchError(errorMessage);
        setIsProcessing(false);
        return;
      }

      console.log(
        `✅ Exam type validation passed: ${detectedExamType.id} matches expected template ${configToUse.templateId}`
      );

      // Validate the exam config
      const validation = validateExamConfig(configToUse);
      if (!validation.isValid) {
        console.error("Exam config validation failed:", validation.errors);
        throw new Error(
          `Exam config validation failed: ${validation.errors.join(", ")}`
        );
      }

      if (validation.warnings.length > 0) {
        console.warn("Exam config validation warnings:", validation.warnings);
      }

      const result = await captureAndProcessImage(
        opencvRef.current,
        canvas,
        detections,
        configToUse,
        realWidth,
        realHeight
      );

      // Store canvas image, original processed image, and field blocks image
      let canvasDataURL = "";
      let fieldBlocksImage = "";
      let illegibleRowImages: { [questionName: string]: string } = {};

      if (canvasRef.current && !capturedImage) {
        canvasDataURL = canvasRef.current.toDataURL("image/png");
        fieldBlocksImage = await generateFieldBlocksImage(
          result.originalDataURL,
          result.examType
        );

        // Generate row images for illegible questions
        illegibleRowImages = await generateIllegibleRowImages(
          fieldBlocksImage,
          result.examResults,
          result.examType
        );

        setCapturedImage({
          canvasDataURL,
          fieldBlocksImage,
          illegibleRowImages,
        });
      }

      // Update refs immediately
      examResultsRef.current = result.examResults;
      setExamResults(result.examResults);

      // Create exam results without bubbles for webview
      const examResultsWithoutBubbles = {
        ...result.examResults,
        questions: result.examResults.questions.map((question) => ({
          ...question,
          bubbles: undefined, // Exclude bubbles from webview data
        })),
      };

      sendMessageToWebView("examResults", {
        examResults: examResultsWithoutBubbles,
        examType: result.examType.name,
        templateId: result.examType.id,
        examConfigId: result.examConfig.examId,
        examConfigName: result.examConfig.examName,
        illegibleRowImages,
      });

      // Play success sound for successful scan
      playSuccess();

      // Log comprehensive exam processing results
      console.log("📋 Exam Processing Complete:", {
        type: "examResults",
        examResults: result.examResults,
        examType: result.examType.name,
        templateId: result.examType.id,
        examConfigId: result.examConfig.examId,
        examConfigName: result.examConfig.examName,
        configSource: "injected/webview",
        markerSignature: result.examType.markerIds.join("-"),
        questionsProcessed: result.examResults.questions.length,
        totalScore: `${result.examResults.pointsAchieved}/${result.examResults.totalPoints}`,
        percentage: Math.round(
          (result.examResults.pointsAchieved / result.examResults.totalPoints) *
            100
        ),
        metadata: result.examType.metadata,
      });

      // Log detailed question results
      console.log("📊 Question Results by Template:");
      result.examResults.questions.forEach((q, index) => {
        const isCorrect = q.selectedAnswer === q.correctAnswer;
        const status =
          q.selectedAnswer === ""
            ? "⚪ (Not answered)"
            : q.selectedAnswer === "?" || q.confidence < 0.3
            ? "❓ (Illegible)"
            : isCorrect
            ? "✅ (Correct)"
            : "❌ (Incorrect)";
        console.log(
          `Q${index + 1}: ${q.selectedAnswer || "No answer"} → ${
            q.correctAnswer
          } ${status} ${
            q.confidence ? `(${Math.round(q.confidence * 100)}%)` : ""
          }`
        );
      });

      // Log illegible questions and their row images
      const illegibleQuestions = result.examResults.questions.filter(
        (q) =>
          (q.confidence > 0 && q.confidence < 0.3) || q.selectedAnswer === "?"
      );
      if (illegibleQuestions.length > 0) {
        console.log("🔍 Illegible Questions Detected:");
        illegibleQuestions.forEach((q) => {
          console.log(
            `- ${q.questionName}: confidence=${Math.round(
              q.confidence * 100
            )}%, answer="${q.selectedAnswer}"`
          );
        });
        console.log(
          `📸 Generated ${
            Object.keys(illegibleRowImages).length
          } row images for illegible questions`
        );
      }

      // Wait until openai is done parsing the personal info
      result.personalInfoPromise.then((personalInfo) => {
        setPersonalInfo(personalInfo);
        console.log("Personal info:", personalInfo);
        sendMessageToWebView("personalInfo", { personalInfo });
      });
    } catch (error) {
      console.error("Capture error:", error);
      isDetectionActiveRef.current = true;
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setDetections([]);
    }
  };

  const handleCloseModal = () => {
    // Update refs immediately
    examResultsRef.current = null;
    isDetectionActiveRef.current = true;

    setExamResults(null);
    setPersonalInfo(null);
    setCurrentExamType(null);
    setCapturedImage(null);
    setExamTypeMismatchError(null);
  };

  // Function to stop the camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
  };

  // Start/stop camera when showing/hiding results
  useEffect(() => {
    if (examResults) {
      stopCamera();
    } else {
      startCamera(facingMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examResults]);

  return (
    // Main container covers the entire viewport for full-screen camera preview
    // Safe areas are handled individually by UI components, not the container
    // - Video/Canvas: Cover entire screen including safe areas for immersive experience
    // - UI Controls: Positioned within safe area boundaries for accessibility
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Video feed covers the entire viewport including safe areas */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />

      {/* Captured images overlay - shows when camera is stopped */}
      {capturedImage && examResults && (
        <>
          {/* Canvas image as background */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage.canvasDataURL}
            alt="Canvas capture"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Field blocks image on top */}
          <div className="absolute inset-0 px-6 bg-black/50 flex items-start flex-col pt-6">
            <div className="flex flex-1/2 justify-center items-end w-full h-[55%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage.fieldBlocksImage}
                alt="Field blocks from exam template"
                className="max-w-md max-h-4/5 mx-auto h-auto object-cover rounded-2xl"
              />
            </div>
            <div className="flex flex-1/2 h-[45%]"></div>
          </div>
        </>
      )}

      {/* Canvas for OpenCV processing - also covers full viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
      />

      {/* Camera Controls - positioned within safe area */}
      {!isWebView && !examTypeMismatchError && (
        <CameraControls
          isMobile={isMobile}
          isProcessing={isProcessing}
          showControls={!examResults}
          onSwitchCamera={switchCamera}
        />
      )}

      {/* Camera Overlay - positioned within safe area */}
      {!examResults && !examTypeMismatchError && (
        <CameraOverlay
          detections={detections}
          isProcessing={isProcessing}
          currentExamType={currentExamType}
        />
      )}

      {/* Results Modal - positioned within safe area */}
      {!!examResults && !isWebView && (
        <ExamResultsModal
          examResults={examResults}
          personalInfo={personalInfo}
          onClose={handleCloseModal}
        />
      )}

      {/* Exam Type Mismatch Error Modal */}
      {examTypeMismatchError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Wrong Exam Type
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {examTypeMismatchError}
              </p>
            </div>
            <button
              onClick={handleCloseModal}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraScanner;
