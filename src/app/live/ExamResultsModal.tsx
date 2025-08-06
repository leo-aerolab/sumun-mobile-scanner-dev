import React, { useState } from "react";
import { ExamResult } from "./examScoring";
import { ExamPersonalInfoType } from "../api/vision/libs";
import ProgressCircle from "../components/ProgressCircle";
import ExamResultsDetail from "./ExamResultsDetail";
import IconIncomplete from "../components/icons/IconIncomplete";
import IconCorrect from "../components/icons/IconCorrect";
import IconIncorrect from "../components/icons/IconIncorrect";
import IconIllegible from "../components/icons/IconIllegible";

interface ExamResultsModalProps {
  examResults: ExamResult;
  personalInfo: ExamPersonalInfoType | null;
  onClose: () => void;
}

export const ExamResultsModal: React.FC<ExamResultsModalProps> = ({
  examResults,
  personalInfo,
  onClose,
}) => {
  const [showDetail, setShowDetail] = useState(false);

  // Calculate summary stats
  let correct = 0, incorrect = 0, incomplete = 0, illegible = 0;
  examResults.questions.forEach((q) => {
    if (q.selectedAnswer === "") incomplete++;
    else if (q.selectedAnswer === "?" || q.confidence < 0.3) illegible++;
    else if (q.selectedAnswer === q.correctAnswer) correct++;
    else incorrect++;
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 py-safe">
      {showDetail && (
        <ExamResultsDetail
          examResults={examResults}
          personalInfo={personalInfo}
          onClose={() => setShowDetail(false)}
        />
      )}
      <div className="bg-white shadow-xl w-full max-w-md mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <button onClick={onClose} className="text-gray-500 text-2xl">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex-1 text-center text-lg text-gray-900">Resultados</div>
          <div className="w-8" /> {/* Spacer for symmetry */}
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Summary Card */}
          <div className="flex flex-col items-center mt-2 mb-4">
            <ProgressCircle percentage={examResults.percentage} large />
            <button
              className="text-gray-600 mt-2 mb-4 font-medium hover:underline"
              onClick={() => setShowDetail(true)}
            >
              Ver detalle
            </button>
          </div>
          {/* Student Info */}
          {personalInfo && (
            <div className="flex items-start gap-2 px-6 mb-8">
              <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15.4899 16.6765V15.1275C15.4899 14.3059 15.1635 13.5179 14.5825 12.9369C14.0016 12.3559 13.2136 12.0295 12.392 12.0295H6.19609C5.37446 12.0295 4.58649 12.3559 4.00551 12.9369C3.42453 13.5179 3.09814 14.3059 3.09814 15.1275V16.6765" stroke="#0E8BFF" strokeWidth="1.54897" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.29374 8.93172C11.0047 8.93172 12.3917 7.54473 12.3917 5.83378C12.3917 4.12284 11.0047 2.73584 9.29374 2.73584C7.5828 2.73584 6.1958 4.12284 6.1958 5.83378C6.1958 7.54473 7.5828 8.93172 9.29374 8.93172Z" stroke="#0E8BFF" strokeWidth="1.54897" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div className="text-gray-900 font-medium leading-tight">{personalInfo.first_name} {personalInfo.last_name}</div>
                <div className="text-gray-400 text-sm leading-tight">ID {personalInfo.student_id}</div>
              </div>
            </div>
          )}
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 px-4 mb-10">
            <div className="bg-gray-100 rounded-xl flex flex-col items-center py-4">
              <div className="text-2xl font-bold text-gray-900">
                {correct}
              </div>
              <div className="text-gray-500 text-sm mt-1 flex gap-2">
                <IconCorrect />
                Correctas
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl flex flex-col items-center py-4">
              <div className="text-2xl font-bold text-gray-900">
                {incorrect}
              </div>
              <div className="text-gray-500 text-sm mt-1 flex gap-2">
                <IconIncorrect />
                Incorrectas
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl flex flex-col items-center py-4">
              <div className="text-2xl font-bold text-gray-900">
                {incomplete}
              </div>
              <div className="text-gray-500 text-sm mt-1 flex gap-2">
                <IconIncomplete />
                Incompletas
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl flex flex-col items-center py-4">
              <div className="text-2xl font-bold text-gray-900">
                {illegible}
              </div>
              <div className="text-gray-500 text-sm mt-1 flex gap-2">
                <IconIllegible />
                Ilegibles
              </div>
            </div>
          </div>
        </div>
        {/* Continue Scanning Button */}
        <div className="px-4 pb-4 flex items-end">
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-colors"
            onClick={onClose}
          >
            Continuar escaneando
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamResultsModal;
