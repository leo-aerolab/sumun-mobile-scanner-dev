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

function sendMessageToWebView(type: string, data: any) {
  if (window.ReactNativeWebView) {
    const message = {
      type,
      ...data,
    };
    console.log("Sending message to webview:", message);
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
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

  // Refs for immediate state tracking to avoid closure stale state
  const isProcessingRef = useRef(false);
  const examResultsRef = useRef<ExamResult | null>(null);
  const isDetectionActiveRef = useRef(true);
  const facingModeRef = useRef<"user" | "environment">("environment");

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

    // Set canvas size to match the field blocks bounding box
    const fieldBlocksWidth = maxRight - minLeft;
    const fieldBlocksHeight = maxBottom - minTop;
    fieldBlocksCanvas.width = fieldBlocksWidth;
    fieldBlocksCanvas.height = fieldBlocksHeight;

    // Create an image from the originalDataURL
    const originalImage = new Image();
    originalImage.crossOrigin = "anonymous";

    return new Promise<string>((resolve) => {
      originalImage.onload = () => {
        // Draw each field block from the original image, adjusted for the new canvas position
        template.fieldBlocks.forEach((block) => {
          const { top, left, width, height } = block;

          // Calculate the new position relative to the field blocks canvas
          const newLeft = left - minLeft;
          const newTop = top - minTop;

          // Draw the region from the original image onto the field blocks canvas
          fieldBlocksCtx.drawImage(
            originalImage,
            left,
            top,
            width,
            height,
            newLeft,
            newTop,
            width,
            height
          );
        });

        resolve(fieldBlocksCanvas.toDataURL("image/png"));
      };

      originalImage.src = originalDataURL;
    });
  };

  // Detect if we're in a webview
  useEffect(() => {
    console.log("WebView detected:", window.ReactNativeWebView);

    if (window.ReactNativeWebView) {
      setIsWebView(true);

      window.addEventListener("closemodal", (event) => {
        console.log("event received: closemodal", event);
        handleCloseModal();
      });

      window.addEventListener("switchcamera", (event) => {
        console.log("event received: switchcamera", event);
        switchCamera();
      });

      window.addEventListener("stopcamera", (event) => {
        console.log("event received: stopcamera", event);
        stopCamera();
      });

      window.addEventListener("startcamera", (event) => {
        console.log("event received: startcamera", event);
        startCamera(facingMode);
      });
    }
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

  // Function to start camera with specific facing mode
  const startCamera = async (facing: "user" | "environment") => {
    if (!videoRef.current) return;

    // Stop current stream if it exists
    if (videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
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
        // Handle play promise to avoid interruption errors
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
          // Handle play promise to avoid interruption errors
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
      const result = await captureAndProcessImage(
        opencvRef.current,
        canvas,
        detections,
        realWidth,
        realHeight
      );

      // Store canvas image, original processed image, and field blocks image
      if (canvasRef.current && !capturedImage) {
        const canvasDataURL = canvasRef.current.toDataURL("image/png");
        const fieldBlocksImage = await generateFieldBlocksImage(
          result.originalDataURL,
          result.examType
        );
        setCapturedImage({
          canvasDataURL,
          fieldBlocksImage,
        });
      }

      // Update refs immediately
      examResultsRef.current = result.examResults;
      setExamResults(result.examResults);

      sendMessageToWebView("examResults", { examResults: result.examResults });

      // Play success sound for successful scan
      playSuccess();

      // Log comprehensive exam processing results
      console.log("📋 Exam Processing Complete:", {
        type: "examResults",
        examResults: result.examResults,
        examType: result.examType.name,
        templateId: result.examType.id,
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
          <img
            src={capturedImage.canvasDataURL}
            alt="Canvas capture"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Field blocks image on top */}
          <div className="absolute inset-0 px-6 bg-black/40 py-safe flex items-start">
            <img
              src={capturedImage.fieldBlocksImage}
              alt="Field blocks from exam template"
              className="max-w-md max-h-2/5 mx-auto h-auto object-cover rounded-2xl mt-16"
            />
          </div>
        </>
      )}

      {/* Canvas for OpenCV processing - also covers full viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
      />

      {/* Camera Controls - positioned within safe area */}
      {!isWebView && (
        <CameraControls
          isMobile={isMobile}
          isProcessing={isProcessing}
          showControls={!examResults}
          onSwitchCamera={switchCamera}
        />
      )}

      {/* Camera Overlay - positioned within safe area */}
      {!examResults && (
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
    </div>
  );
};

export default CameraScanner;
