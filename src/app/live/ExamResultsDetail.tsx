import React from "react";
import { ExamResult } from "./examScoring";
import { ExamPersonalInfoType } from "../api/vision/libs";
import ProgressCircle from "../components/ProgressCircle";
import IconIncomplete from "../components/icons/IconIncomplete";
import IconCorrect from "../components/icons/IconCorrect";
import IconIncorrect from "../components/icons/IconIncorrect";
import IconIllegible from "../components/icons/IconIllegible";

interface ExamResultsDetailProps {
  examResults: ExamResult;
  personalInfo: ExamPersonalInfoType | null;
  onClose: () => void;
}

function getStatusIcon(selected: string, correct: string, confidence: number) {
  if (selected === "") {
    // Not answered
    return (
      <span className="text-blue-600 text-xl mr-4">
        <IconIncomplete />
      </span>
    );
  } else if (selected === "?" || confidence < 0.3) {
    // Illegible
    return (
      <span className="text-yellow-500 text-xl mr-4">
        <IconIllegible />
      </span>
    );
  } else if (selected === correct) {
    // Correct
    return (
      <span className="text-green-600 text-xl mr-4">
        <IconCorrect />
      </span>
    );
  } else {
    // Incorrect
    return (
      <span className="text-red-500 text-xl mr-4">
        <IconIncorrect />
      </span>
    );
  }
}

function getStatusColor(selected: string, correct: string, confidence: number) {
  if (selected === "") return "text-blue-600";
  if (selected === "?" || confidence < 0.3) return "text-yellow-500";
  if (selected === correct) return "text-green-600";
  return "text-red-500";
}

export const ExamResultsDetail: React.FC<ExamResultsDetailProps> = ({
  examResults,
  onClose,
}) => {
  const percentage = examResults.percentage;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 py-safe">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto flex flex-col overflow-y-auto flex-1 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <button onClick={onClose} className="text-gray-500 text-2xl">
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex-1 text-center text-lg text-gray-900">
            Detalle de resultados
          </div>
          <div className="w-8" /> {/* Spacer for symmetry */}
        </div>
        {/* Progress Circle */}
        <div className="flex flex-col items-center mt-2 mb-4">
          <ProgressCircle percentage={percentage} />
        </div>
        {/* Questions List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {examResults.questions.map((q, idx) => (
            <div
              key={idx}
              className="flex items-center py-3 border-b border-gray-100"
            >
              {getStatusIcon(q.selectedAnswer, q.correctAnswer, q.confidence)}
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  Pregunta {idx + 1}
                </div>
                <div className="text-sm text-gray-500 flex gap-4 justify-between">
                  <span>
                    Respuesta:{" "}
                    <span
                      className={getStatusColor(
                        q.selectedAnswer,
                        q.correctAnswer,
                        q.confidence
                      )}
                    >
                      {q.selectedAnswer === ""
                        ? "-"
                        : q.selectedAnswer === "?" || q.confidence < 0.3
                        ? "Ilegible"
                        : q.selectedAnswer}
                    </span>
                  </span>
                  <span>
                    Respuesta correcta:{" "}
                    <span className="text-gray-900">{q.correctAnswer}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExamResultsDetail;
