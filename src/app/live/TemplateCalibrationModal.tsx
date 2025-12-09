"use client";

import React, { useState, useEffect, useRef } from "react";
import { CV, Mat } from "@techstark/opencv-js";
import { ExamTemplate } from "./types";
import { ExamResult } from "./examScoring";
import { bubbleContents, evaluateBubble, ROI } from "./examScoring";

interface TemplateCalibrationModalProps {
  template: ExamTemplate;
  examResults: ExamResult;
  processedImageDataURL: string;
  cv: CV | null;
  processedMat: Mat | null;
  onClose: () => void;
  onSave: (updatedTemplate: ExamTemplate) => void;
}

interface BubbleFillData {
  questionIndex: number;
  option: string;
  fill: number;
  isSelected: boolean;
  passesMarkThresh: boolean;
  passesMinDelta: boolean;
  base64Image?: string;
}

export const TemplateCalibrationModal: React.FC<TemplateCalibrationModalProps> = ({
  template,
  examResults,
  processedImageDataURL,
  cv,
  processedMat,
  onClose,
  onSave,
}) => {
  const [localTemplate, setLocalTemplate] = useState<ExamTemplate>(JSON.parse(JSON.stringify(template)));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [showBubbles, setShowBubbles] = useState(true);
  const [bubbleFillData, setBubbleFillData] = useState<BubbleFillData[]>([]);
  const [showFillValues, setShowFillValues] = useState(true);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, string>>({});
  const [suggestedValues, setSuggestedValues] = useState<{
    markThresh?: number;
    minDelta?: number;
    padding?: number;
  } | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<Record<number, {
    isDetected: boolean;
    correctFill: number;
    darkestFill: number;
    delta: number;
    reason?: string;
  }>>({});
  const processedMatRef = useRef<Mat | null>(null);

  // Redraw overlay when template changes
  useEffect(() => {
    if (!canvasRef.current || !processedImageDataURL) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const [pageW, pageH] = localTemplate.pageDimensions;
      const scaleX = canvas.width / pageW;
      const scaleY = canvas.height / pageH;

      // Draw vision block (blue outline)
      if (localTemplate.visionBlock) {
        const vb = localTemplate.visionBlock;
        ctx.strokeStyle = "#0066ff";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(vb.left * scaleX, vb.top * scaleY, vb.width * scaleX, vb.height * scaleY);
        ctx.setLineDash([]);
      }

      // Draw field blocks
      localTemplate.fieldBlocks.forEach((block, blockIdx) => {
        const { top, left, width, height, numOptions, numQuestions, gapX, gapY } = block;
        
        // Draw field block boundary
        ctx.strokeStyle = blockIdx === selectedBlockIndex ? "#ff6600" : "#ffaa00";
        ctx.lineWidth = blockIdx === selectedBlockIndex ? 3 : 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(left * scaleX, top * scaleY, width * scaleX, height * scaleY);
        ctx.setLineDash([]);

        // Draw individual bubbles if enabled
        if (showBubbles) {
          const cellW = (width - (gapX || 0) * (numOptions - 1)) / numOptions;
          const cellH = (height - (gapY || 0) * (numQuestions - 1)) / numQuestions;
          let questionIndex = blockIdx === 0 ? 0 : localTemplate.fieldBlocks.slice(0, blockIdx).reduce((sum, b) => sum + (b.numQuestions || 0), 0);

          for (let q = 0; q < numQuestions; q++) {
            const questionResult = examResults.questions[questionIndex];
            
            for (let o = 0; o < numOptions; o++) {
              const bubbleX = left + o * cellW + o * (gapX || 0);
              const bubbleY = top + q * cellH + q * (gapY || 0);
              
              const bubble = questionResult?.bubbles?.find(b => b.option === String.fromCharCode(65 + o));
              const isSelected = bubble?.isSelected || false;
              
              ctx.strokeStyle = isSelected ? "#00ff00" : "#888888";
              ctx.lineWidth = 1;
              ctx.strokeRect(
                bubbleX * scaleX,
                bubbleY * scaleY,
                cellW * scaleX,
                cellH * scaleY
              );
            }
            questionIndex++;
          }
        }
      });
    };

    img.src = processedImageDataURL;
  }, [localTemplate, examResults, processedImageDataURL, selectedBlockIndex, showBubbles]);

  const updateFieldBlock = (blockIndex: number, updates: Partial<typeof localTemplate.fieldBlocks[0]>) => {
    const newTemplate = { ...localTemplate };
    newTemplate.fieldBlocks = [...newTemplate.fieldBlocks];
    newTemplate.fieldBlocks[blockIndex] = {
      ...newTemplate.fieldBlocks[blockIndex],
      ...updates,
    };
    setLocalTemplate(newTemplate);
  };

  const updateVisionBlock = (updates: Partial<typeof localTemplate.visionBlock>) => {
    if (!localTemplate.visionBlock) return;
    setLocalTemplate({
      ...localTemplate,
      visionBlock: {
        ...localTemplate.visionBlock,
        ...updates,
      },
    });
  };

  const updateBubbleDetection = (updates: Partial<typeof localTemplate.bubbleDetection>) => {
    setLocalTemplate({
      ...localTemplate,
      bubbleDetection: {
        ...localTemplate.bubbleDetection,
        ...updates,
      },
    });
  };

  // Function to calculate fills (extracted for reuse)
  const calculateFills = React.useCallback(() => {
    if (!cv || !processedMatRef.current) {
      setBubbleFillData([]);
      return;
    }

    const processedMat = processedMatRef.current;
    if (!processedMat || processedMat.cols === 0 || processedMat.rows === 0) {
      setBubbleFillData([]);
      return;
    }

    try {
      const fills: BubbleFillData[] = [];
      const [tplW, tplH] = localTemplate.pageDimensions;
      const sx = processedMat.cols / tplW;
      const sy = processedMat.rows / tplH;

      const markThresh = localTemplate.bubbleDetection?.markThresh ?? 0.3;
      const minDelta = localTemplate.bubbleDetection?.minDelta ?? markThresh / 2;
      const bubbleShape = localTemplate.bubbleDetection?.bubbleShape ?? "circle";
      const customPadding = localTemplate.bubbleDetection?.padding;

      let questionIndex = 0;

      for (const block of localTemplate.fieldBlocks) {
        const { top, left, width, height, numOptions, numQuestions, gapX, gapY } = block;
        const cellW = (width - (gapX || 0) * (numOptions - 1)) / numOptions;
        const cellH = (height - (gapY || 0) * (numQuestions - 1)) / numQuestions;

        for (let q = 0; q < numQuestions; q++) {
          const questionFillValues: { option: string; fill: number; base64Image: string }[] = [];

          for (let o = 0; o < numOptions; o++) {
            const roi: ROI = {
              x: Math.round((left + o * cellW + o * (gapX || 0)) * sx),
              y: Math.round((top + q * cellH + q * (gapY || 0)) * sy),
              w: Math.round(cellW * sx),
              h: Math.round(cellH * sy),
            };

            try {
              const { fill, base64Image } = evaluateBubble(
                cv,
                processedMatRef.current,
                roi,
                q + 1,
                o + 1,
                bubbleShape,
                customPadding
              );

              const option = String.fromCharCode(65 + o);
              questionFillValues.push({ option, fill, base64Image });
            } catch (error) {
              console.error(`Error evaluating bubble Q${q + 1} ${String.fromCharCode(65 + o)}:`, error);
            }
          }

          // Sort by fill to determine selection
          questionFillValues.sort((a, b) => b.fill - a.fill);
          const darkest = questionFillValues[0];
          const secondDarkest = questionFillValues[1] || { fill: 0 };

          // Check which bubbles pass thresholds
          // Logic must match examScoring.ts exactly:
          // - hasValidSelection = darkest.fill >= markThresh
          // - hasSignificantDifference = darkest.fill - secondDarkest.fill >= minDelta
          // - selectedAnswer = darkest.option if both true, "?" if only hasValidSelection, "" otherwise
          const hasValidSelection = darkest.fill >= markThresh;
          const hasSignificantDifference = darkest.fill - secondDarkest.fill >= minDelta;
          const wouldBeIllegible = hasValidSelection && !hasSignificantDifference;
          
          questionFillValues.forEach(({ option, fill, base64Image }) => {
            const isDarkest = option === darkest.option;
            const passesMarkThresh = fill >= markThresh;
            const passesMinDelta = isDarkest ? hasSignificantDifference : false;
            
            // Selected only if: is darkest AND hasValidSelection AND hasSignificantDifference
            const isSelected = isDarkest && hasValidSelection && hasSignificantDifference;

            fills.push({
              questionIndex,
              option,
              fill,
              isSelected,
              passesMarkThresh,
              passesMinDelta: isDarkest ? hasSignificantDifference : false,
              base64Image,
            });
          });

          questionIndex++;
        }
      }

      setBubbleFillData(fills);
    } catch (error) {
      console.error("Error calculating fills:", error);
      setBubbleFillData([]);
    }
  }, [cv, localTemplate]);

  // Load processed image as Mat when component mounts
  useEffect(() => {
    if (!cv || !processedImageDataURL) {
      setBubbleFillData([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBubbleFillData([]);
        return;
      }
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to Mat
      if (processedMatRef.current) {
        processedMatRef.current.delete();
      }
      processedMatRef.current = cv.imread(canvas);
      
      // Trigger recalculation after Mat is loaded
      if (showFillValues) {
        calculateFills();
      }
    };
    img.onerror = () => {
      console.error("Failed to load processed image");
      setBubbleFillData([]);
    };
    img.src = processedImageDataURL;

    return () => {
      if (processedMatRef.current) {
        processedMatRef.current.delete();
        processedMatRef.current = null;
      }
    };
  }, [cv, processedImageDataURL, showFillValues, calculateFills]);

  // Recalculate bubble fill values when template or detection params change
  useEffect(() => {
    if (showFillValues && processedMatRef.current) {
      calculateFills();
    } else if (!showFillValues) {
      setBubbleFillData([]);
    }
  }, [showFillValues, localTemplate, calculateFills]);

  // Clear suggested values when correct answers or fill data changes
  useEffect(() => {
    setSuggestedValues(null);
  }, [correctAnswers, bubbleFillData.length]);

  const handleSave = async () => {
    console.log("💾 Guardando template actualizado...", localTemplate);
    console.log("📋 Valores de bubbleDetection:", localTemplate.bubbleDetection);
    
    // Call onSave (which will trigger recalculation)
    // Wait for it to complete before closing
    try {
      await onSave(localTemplate);
      console.log("✅ onSave completado, cerrando modal...");
    } catch (error) {
      console.error("❌ Error en onSave:", error);
    }
    
    // Show warning if there are questions that would be illegible
    const markThresh = localTemplate.bubbleDetection?.markThresh ?? 0.3;
    const minDelta = localTemplate.bubbleDetection?.minDelta ?? markThresh / 2;
    
    const questions = new Map<number, BubbleFillData[]>();
    bubbleFillData.forEach(data => {
      if (!questions.has(data.questionIndex)) {
        questions.set(data.questionIndex, []);
      }
      questions.get(data.questionIndex)!.push(data);
    });
    
    const illegibleQuestions: number[] = [];
    questions.forEach((bubbles, qIndex) => {
      const sorted = [...bubbles].sort((a, b) => b.fill - a.fill);
      const darkest = sorted[0];
      const secondDarkest = sorted[1] || { fill: 0 };
      const hasValidSelection = darkest.fill >= markThresh;
      const hasSignificantDifference = darkest.fill - secondDarkest.fill >= minDelta;
      const wouldBeIllegible = hasValidSelection && !hasSignificantDifference;
      
      if (wouldBeIllegible) {
        illegibleQuestions.push(qIndex + 1);
      }
    });
    
    if (illegibleQuestions.length > 0) {
      const message = `⚠️ Advertencia: Las siguientes preguntas serían marcadas como "Ilegible" con estos valores: ${illegibleQuestions.join(", ")}. Considera ajustar minDelta o markThresh.`;
      alert(message);
    }
    
    onClose();
  };

  const handleExport = () => {
    const json = JSON.stringify(localTemplate, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "examTemplate-calibrated.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate optimal values based on correct answers
  const calculateOptimalValues = () => {
    if (!bubbleFillData.length || Object.keys(correctAnswers).length === 0) {
      setSuggestedValues(null);
      setDetectionStatus({});
      return;
    }

    // Group by question
    const questions = new Map<number, BubbleFillData[]>();
    bubbleFillData.forEach(data => {
      if (!questions.has(data.questionIndex)) {
        questions.set(data.questionIndex, []);
      }
      questions.get(data.questionIndex)!.push(data);
    });

    const validQuestions: Array<{
      questionIndex: number;
      correctOption: string;
      fills: BubbleFillData[];
    }> = [];

    // Collect valid questions with correct answers
    questions.forEach((bubbles, qIndex) => {
      const correctAnswer = correctAnswers[qIndex];
      if (correctAnswer && correctAnswer.length > 0) {
        validQuestions.push({
          questionIndex: qIndex,
          correctOption: correctAnswer.toUpperCase(),
          fills: bubbles,
        });
      }
    });

    if (validQuestions.length === 0) {
      setSuggestedValues(null);
      setDetectionStatus({});
      return;
    }

    // Calculate optimal markThresh
    // We want the lowest markThresh that still correctly identifies all correct answers
    let optimalMarkThresh = 0;
    let optimalMinDelta = 0;
    
    const allCorrectFills: number[] = [];
    const allIncorrectFills: number[] = [];
    const deltas: number[] = [];
    const status: Record<number, {
      isDetected: boolean;
      correctFill: number;
      darkestFill: number;
      delta: number;
      reason?: string;
    }> = {};

    const currentMarkThresh = localTemplate.bubbleDetection?.markThresh ?? 0.3;
    const currentMinDelta = localTemplate.bubbleDetection?.minDelta ?? currentMarkThresh / 2;

    validQuestions.forEach(({ questionIndex, correctOption, fills }) => {
      const sorted = [...fills].sort((a, b) => b.fill - a.fill);
      const correctFill = fills.find(f => f.option === correctOption);
      const darkest = sorted[0];
      const secondDarkest = sorted[1] || { fill: 0 };
      const delta = darkest.fill - secondDarkest.fill;

      if (correctFill) {
        allCorrectFills.push(correctFill.fill);
        
        // Check if currently detected
        const passesThresh = correctFill.fill >= currentMarkThresh;
        const isDarkest = correctFill.option === darkest.option;
        const passesDelta = isDarkest && delta >= currentMinDelta;
        const isDetected = passesThresh && passesDelta && isDarkest;

        // Store detection status
        status[questionIndex] = {
          isDetected,
          correctFill: correctFill.fill,
          darkestFill: darkest.fill,
          delta: isDarkest ? delta : 0,
          reason: !passesThresh 
            ? `Fill (${(correctFill.fill * 100).toFixed(1)}%) < markThresh (${(currentMarkThresh * 100).toFixed(1)}%)`
            : !isDarkest
            ? `No es la más oscura (más oscura: ${darkest.option} con ${(darkest.fill * 100).toFixed(1)}%)`
            : !passesDelta
            ? `Delta (${(delta * 100).toFixed(1)}%) < minDelta (${(currentMinDelta * 100).toFixed(1)}%)`
            : undefined
        };
        
        // If correct answer is the darkest, calculate delta
        if (isDarkest) {
          deltas.push(delta);
        }
      }

      // Collect incorrect fills (all except correct)
      fills.forEach(f => {
        if (f.option !== correctOption) {
          allIncorrectFills.push(f.fill);
        }
      });
    });

    setDetectionStatus(status);

    if (allCorrectFills.length === 0) {
      setSuggestedValues(null);
      return;
    }

    // Optimal markThresh: use a more conservative approach
    // Find the minimum correct fill and ensure we're well below it
    const minCorrectFill = Math.min(...allCorrectFills);
    const maxIncorrectFill = Math.max(...allIncorrectFills);
    
    // Strategy: Use a value that's safely below the minimum correct fill
    // This ensures we catch all correct answers, even if some are lighter
    if (minCorrectFill > maxIncorrectFill) {
      // Clear separation: use a value between them
      optimalMarkThresh = (maxIncorrectFill + minCorrectFill) / 2;
      // But ensure we're at least 10% below min correct to catch lighter marks
      optimalMarkThresh = Math.min(optimalMarkThresh, minCorrectFill * 0.9);
    } else {
      // Overlap case: use a conservative value well below min correct
      optimalMarkThresh = minCorrectFill * 0.7; // 70% of minimum correct
    }
    
    // Ensure we're above noise level but not too high
    optimalMarkThresh = Math.max(0.05, Math.min(0.4, optimalMarkThresh));

    // Optimal minDelta: be more lenient to catch cases where correct answer is only slightly darker
    if (deltas.length > 0) {
      const sortedDeltas = [...deltas].sort((a, b) => a - b);
      const minDelta = Math.min(...deltas); // Use minimum delta to be more inclusive
      const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)];
      
      // Use a value that's lower than the minimum delta to catch edge cases
      // But not so low that it causes false positives
      optimalMinDelta = Math.max(0.01, Math.min(0.2, minDelta * 0.5)); // 50% of minimum delta
      
      // If minimum delta is very small, use an even more lenient value
      if (minDelta < 0.05) {
        optimalMinDelta = Math.max(0.01, minDelta * 0.3); // Even more lenient for tight cases
      }
    } else {
      // Fallback: use a smaller percentage of markThresh for more leniency
      optimalMinDelta = optimalMarkThresh * 0.25; // Reduced from 0.4 to 0.25
    }
    
    // Ensure minDelta is reasonable
    optimalMinDelta = Math.max(0.01, Math.min(0.15, optimalMinDelta));

    // Keep current padding or suggest based on bubble shape
    const currentPadding = localTemplate.bubbleDetection?.padding;
    const optimalPadding = currentPadding ?? (
      localTemplate.bubbleDetection?.bubbleShape === "rectangle" ? 0.1 : 0.2
    );

    setSuggestedValues({
      markThresh: Math.round(optimalMarkThresh * 1000) / 1000, // Round to 3 decimals
      minDelta: Math.round(optimalMinDelta * 1000) / 1000,
      padding: optimalPadding,
    });
  };

  const applySuggestedValues = () => {
    if (suggestedValues) {
      updateBubbleDetection(suggestedValues);
    }
  };

  const currentBlock = localTemplate.fieldBlocks[selectedBlockIndex];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">Calibración de Template</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Controls */}
          <div className="w-96 border-r overflow-y-auto p-4 space-y-6">
            {/* Field Block Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bloque de Preguntas
              </label>
              <select
                value={selectedBlockIndex}
                onChange={(e) => setSelectedBlockIndex(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {localTemplate.fieldBlocks.map((block, idx) => (
                  <option key={idx} value={idx}>
                    {block.name || `Bloque ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Field Block Controls */}
            {currentBlock && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Posición y Tamaño</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Top</label>
                  <input
                    type="number"
                    value={currentBlock.top}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { top: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Distancia desde el borde superior de la página hasta el inicio del bloque de preguntas (en píxeles del template).
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Left</label>
                  <input
                    type="number"
                    value={currentBlock.left}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { left: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Distancia desde el borde izquierdo de la página hasta el inicio del bloque de preguntas (en píxeles del template).
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Width</label>
                  <input
                    type="number"
                    value={currentBlock.width}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { width: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Ancho total del bloque de preguntas, incluyendo todas las columnas de opciones (en píxeles del template).
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Height</label>
                  <input
                    type="number"
                    value={currentBlock.height}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { height: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Alto total del bloque de preguntas, incluyendo todas las filas de preguntas (en píxeles del template).
                  </p>
                </div>

                <h3 className="font-semibold text-gray-900 mt-4">Espaciado</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Gap X (horizontal)</label>
                  <input
                    type="number"
                    value={currentBlock.gapX || 0}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { gapX: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Espacio horizontal entre el centro de una burbuja y el centro de la siguiente (distancia centro a centro). 
                    Si es 0, las burbujas están pegadas.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Gap Y (vertical)</label>
                  <input
                    type="number"
                    value={currentBlock.gapY || 0}
                    onChange={(e) => updateFieldBlock(selectedBlockIndex, { gapY: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Espacio vertical entre el centro de una fila de burbujas y el centro de la siguiente (distancia centro a centro).
                    Si es 0, las filas están pegadas.
                  </p>
                </div>
              </div>
            )}

            {/* Vision Block Controls */}
            {localTemplate.visionBlock && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-gray-900">Bloque de Información Personal</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Área donde se encuentra el nombre del estudiante u otra información personal que se extraerá con OCR.
                </p>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Top</label>
                  <input
                    type="number"
                    value={localTemplate.visionBlock.top}
                    onChange={(e) => updateVisionBlock({ top: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Distancia desde el borde superior hasta el inicio del campo de información personal.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Left</label>
                  <input
                    type="number"
                    value={localTemplate.visionBlock.left}
                    onChange={(e) => updateVisionBlock({ left: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Distancia desde el borde izquierdo hasta el inicio del campo de información personal.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Width</label>
                  <input
                    type="number"
                    value={localTemplate.visionBlock.width}
                    onChange={(e) => updateVisionBlock({ width: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Ancho del área de información personal.
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Height</label>
                  <input
                    type="number"
                    value={localTemplate.visionBlock.height}
                    onChange={(e) => updateVisionBlock({ height: Number(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Alto del área de información personal.
                  </p>
                </div>
              </div>
            )}

            {/* Bubble Detection Controls */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-gray-900">Detección de Burbujas</h3>
              
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  markThresh
                  <span className="ml-1 text-gray-500 font-normal">(0.0 - 1.0)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localTemplate.bubbleDetection?.markThresh ?? 0.3}
                  onChange={(e) => updateBubbleDetection({ markThresh: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Umbral mínimo de oscuridad:</strong> Proporción de píxeles oscuros (0-1) necesaria para considerar una burbuja como "marcada". 
                  Valores más bajos = más sensible (detecta marcas más claras). Valores más altos = más estricto (requiere marcas más oscuras).
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  minDelta
                  <span className="ml-1 text-gray-500 font-normal">(0.0 - 1.0)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={localTemplate.bubbleDetection?.minDelta ?? 0.15}
                  onChange={(e) => updateBubbleDetection({ minDelta: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Diferencia mínima:</strong> Diferencia requerida entre la burbuja más oscura y la segunda más oscura para considerar la selección válida.
                  Evita ambigüedad cuando varias burbujas tienen valores similares. Valores más bajos = permite diferencias menores.
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-1">
                  Padding
                  <span className="ml-1 text-gray-500 font-normal">(0.0 - 0.5)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={localTemplate.bubbleDetection?.padding ?? (localTemplate.bubbleDetection?.bubbleShape === "rectangle" ? 0.1 : 0.2)}
                  onChange={(e) => updateBubbleDetection({ padding: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-600 mt-1">
                  <strong>Margen interno:</strong> Proporción del área de la burbuja que se excluye del análisis (para evitar bordes).
                  Valores más bajos = analiza más área (útil para rectángulos). Valores más altos = excluye más área (útil para círculos con bordes gruesos).
                </p>
              </div>
            </div>

            {/* Correct Answers Input */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Respuestas Correctas</h3>
              <p className="text-xs text-gray-600 mb-3">
                Ingresa las respuestas correctas (A, B, C, etc.) para que el sistema sugiera valores óptimos.
              </p>
              <div className="space-y-2 mb-3">
                {Array.from({ length: localTemplate.fieldBlocks.reduce((sum, b) => sum + (b.numQuestions || 0), 0) }, (_, i) => {
                  const numOptions = localTemplate.fieldBlocks[0]?.numOptions || 3;
                  const options = Array.from({ length: numOptions }, (_, j) => String.fromCharCode(65 + j));
                  
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-900 w-12">
                        Q{i + 1}:
                      </label>
                      <select
                        value={correctAnswers[i] || ""}
                        onChange={(e) => {
                          const newAnswers = { ...correctAnswers };
                          if (e.target.value) {
                            newAnswers[i] = e.target.value;
                          } else {
                            delete newAnswers[i];
                          }
                          setCorrectAnswers(newAnswers);
                        }}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">--</option>
                        {options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={calculateOptimalValues}
                disabled={Object.keys(correctAnswers).length === 0}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-semibold"
              >
                Calcular Valores Óptimos
              </button>
              
              {/* Detection Status */}
              {Object.keys(detectionStatus).length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                  <h4 className="text-xs font-bold text-blue-900 mb-2">Estado de Detección Actual:</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {Object.entries(detectionStatus).map(([qIndex, status]) => (
                      <div
                        key={qIndex}
                        className={`text-xs p-1.5 rounded border ${
                          status.isDetected
                            ? "bg-green-100 border-green-400"
                            : "bg-red-100 border-red-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            Q{Number(qIndex) + 1}: {status.isDetected ? "✓ Detectada" : "✗ No detectada"}
                          </span>
                          <span className="font-mono text-xs">
                            Fill: {(status.correctFill * 100).toFixed(1)}%
                          </span>
                        </div>
                        {!status.isDetected && status.reason && (
                          <p className="text-xs text-red-700 mt-1 italic">{status.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggestedValues && (
                <div className="mt-3 p-3 bg-green-50 border-2 border-green-400 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-green-900">Valores Sugeridos:</span>
                    <button
                      onClick={applySuggestedValues}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Aplicar
                    </button>
                  </div>
                  <div className="space-y-1 text-xs mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-700">markThresh:</span>
                      <span className="font-mono font-bold text-green-800">{suggestedValues.markThresh?.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">minDelta:</span>
                      <span className="font-mono font-bold text-green-800">{suggestedValues.minDelta?.toFixed(3)}</span>
                    </div>
                    {suggestedValues.padding !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">padding:</span>
                        <span className="font-mono font-bold text-green-800">{suggestedValues.padding.toFixed(3)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 italic">
                    💡 Estos valores están optimizados para detectar todas las respuestas correctas, incluso marcas más claras.
                  </p>
                </div>
              )}
            </div>

            {/* Toggle bubbles */}
            <div className="border-t pt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showBubbles}
                  onChange={(e) => setShowBubbles(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Mostrar burbujas individuales</span>
              </label>
            </div>

            {/* Fill Values Debug Panel */}
            <div className="border-t pt-4">
              <label className="flex items-center space-x-2 mb-3">
                <input
                  type="checkbox"
                  checked={showFillValues}
                  onChange={(e) => setShowFillValues(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-semibold text-gray-700">Valores de Fill (Debug)</span>
              </label>
              
              {showFillValues && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bubbleFillData.length === 0 ? (
                    <p className="text-xs text-gray-500">Cargando valores...</p>
                  ) : (() => {
                    const markThresh = localTemplate.bubbleDetection?.markThresh ?? 0.3;
                    const minDelta = localTemplate.bubbleDetection?.minDelta ?? markThresh / 2;
                    
                    // Group by question
                    const questions = new Map<number, BubbleFillData[]>();
                    bubbleFillData.forEach(data => {
                      if (!questions.has(data.questionIndex)) {
                        questions.set(data.questionIndex, []);
                      }
                      questions.get(data.questionIndex)!.push(data);
                    });
                    
                    return Array.from(questions.entries()).map(([qIndex, bubbles]) => {
                      const sorted = [...bubbles].sort((a, b) => b.fill - a.fill);
                      const darkest = sorted[0];
                      const secondDarkest = sorted[1] || { fill: 0 };
                      const delta = darkest.fill - secondDarkest.fill;
                      
                      // Determine if this question would be illegible (matches examScoring.ts logic exactly)
                      const markThresh = localTemplate.bubbleDetection?.markThresh ?? 0.3;
                      const minDelta = localTemplate.bubbleDetection?.minDelta ?? markThresh / 2;
                      const hasValidSelection = darkest.fill >= markThresh;
                      const hasSignificantDifference = delta >= minDelta;
                      const questionWouldBeIllegible = hasValidSelection && !hasSignificantDifference;
                      
                      return (
                        <div key={qIndex} className="border-2 border-gray-300 rounded-lg p-2.5 bg-gray-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-gray-900">Pregunta {qIndex + 1}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800 bg-white px-2 py-0.5 rounded">
                                Delta: {(delta * 100).toFixed(1)}%
                              </span>
                              {questionWouldBeIllegible && (
                                <span className="text-xs font-bold text-orange-800 bg-orange-200 px-2 py-0.5 rounded">
                                  ⚠ ILEGIBLE
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {sorted.map((data) => {
                              const fillPercent = (data.fill * 100).toFixed(2);
                              const fillValue = data.fill.toFixed(4);
                              const isDarkest = data.option === darkest.option;
                              
                              // Determine if this specific bubble would cause illegible status
                              // (only the darkest bubble can cause illegible if it passes markThresh but not minDelta)
                              const bubbleWouldCauseIllegible = isDarkest && questionWouldBeIllegible;
                              
                              return (
                                <div
                                  key={data.option}
                                  className={`text-xs p-2 rounded border-2 ${
                                    data.isSelected
                                      ? "bg-green-200 border-green-600"
                                      : bubbleWouldCauseIllegible
                                      ? "bg-orange-200 border-orange-600"
                                      : data.passesMarkThresh
                                      ? "bg-yellow-200 border-yellow-600"
                                      : "bg-white border-gray-400"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5">
                                      <span className={`font-mono font-bold w-8 text-base ${
                                        isDarkest ? "text-blue-900" : "text-gray-900"
                                      }`}>
                                        {data.option}
                                      </span>
                                      <span className="font-mono font-semibold text-gray-900">
                                        {fillValue}
                                      </span>
                                      <span className="font-semibold text-gray-800">
                                        ({fillPercent}%)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                      {data.passesMarkThresh ? (
                                        <span className="text-green-800 bg-green-100 px-1.5 py-0.5 rounded" title={`Pasa markThresh (${(markThresh * 100).toFixed(1)}%)`}>✓T</span>
                                      ) : (
                                        <span className="text-red-800 bg-red-100 px-1.5 py-0.5 rounded" title={`No pasa markThresh (${(markThresh * 100).toFixed(1)}%)`}>✗T</span>
                                      )}
                                      {isDarkest && (
                                        delta >= minDelta ? (
                                          <span className="text-green-800 bg-green-100 px-1.5 py-0.5 rounded" title={`Pasa minDelta (${(minDelta * 100).toFixed(1)}%)`}>✓D</span>
                                        ) : (
                                          <span className="text-red-800 bg-red-100 px-1.5 py-0.5 rounded" title={`No pasa minDelta (${(minDelta * 100).toFixed(1)}%)`}>✗D</span>
                                        )
                                      )}
                                      {data.isSelected && (
                                        <span className="text-green-900 bg-green-300 px-2 py-0.5 rounded font-bold">✓ SEL</span>
                                      )}
                                      {bubbleWouldCauseIllegible && (
                                        <span className="text-orange-900 bg-orange-300 px-2 py-0.5 rounded font-bold" title="Pasa markThresh pero NO pasa minDelta → sería marcado como 'Ilegible' (?) en resultados">⚠ ILEG</span>
                                      )}
                                    </div>
                                  </div>
                                  {data.base64Image && (
                                    <div className="mt-2 pt-2 border-t border-gray-400">
                                      <img
                                        src={data.base64Image}
                                        alt={`Burbuja ${data.option} Q${qIndex + 1}`}
                                        className="max-w-full h-auto border border-gray-500 rounded bg-white"
                                        style={{ maxHeight: "80px", imageRendering: "pixelated" }}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2.5 pt-2 border-t-2 border-gray-400 text-xs font-semibold text-gray-900 bg-white px-2 py-1 rounded">
                            <div className="flex justify-between">
                              <span>Thresh: {(markThresh * 100).toFixed(1)}%</span>
                              <span>MinDelta: {(minDelta * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Canvas Preview */}
          <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-start justify-center">
            <div className="inline-block max-w-2xl">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded shadow-lg max-w-full"
                style={{ imageRendering: "pixelated", maxWidth: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Exportar JSON
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

