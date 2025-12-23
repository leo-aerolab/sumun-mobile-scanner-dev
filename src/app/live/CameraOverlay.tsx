import React from "react";
import { useTranslations } from "next-intl";
import { Detection } from "./markerDetection";
import { ExamSignature } from "./examSignature";

interface CameraOverlayProps {
  detections: Detection[];
  isProcessing: boolean;
  currentExamType?: ExamSignature | null;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  detections,
  isProcessing,
  currentExamType,
}) => {
  const t = useTranslations();
  // Define the expected marker IDs based on current exam type or default to 1x1
  const expectedMarkers = currentExamType ? currentExamType.markerIds : [22, 10, 30, 41, 34, 15];
  
  // Define the 6 marker detection zones in a 3x2 grid
  const zones = [
    {
      id: expectedMarkers[0], // Top Left
      name: "Top Left",
      highlightClass: "rounded-tl-xl border-r-0 border-b-0",
      defaultClass: "rounded-tl-xl border-r-0 border-b-0",
    },
    {
      id: expectedMarkers[1], // Top Right
      name: "Top Right",
      highlightClass: "rounded-tr-xl border-l-0 border-b-0",
      defaultClass: "rounded-tr-xl border-l-0 border-b-0",
    },
    {
      id: expectedMarkers[2], // Center Left
      name: "Center Left",
      highlightClass: "border-t-0 border-b-0 border-r-0",
      defaultClass: "border-t-0 border-b-0 border-r-0",
    },
    {
      id: expectedMarkers[3], // Center Right
      name: "Center Right",
      highlightClass: "border-r-8 border-t-0 border-b-0 border-l-0",
      defaultClass: "border-t-0 border-b-0 border-l-0",
    },
    {
      id: expectedMarkers[4], // Bottom Left
      name: "Bottom Left",
      highlightClass: "rounded-bl-xl border-t-0 border-r-0",
      defaultClass: "rounded-bl-xl border-t-0 border-r-0",
    },
    {
      id: expectedMarkers[5], // Bottom Right
      name: "Bottom Right",
      highlightClass: "rounded-br-xl border-t-0 border-l-0",
      defaultClass: "rounded-br-xl border-t-0 border-l-0",
    },
  ];

  return (
    // Main overlay container positioned within the safe area
    // Since parent container now covers full screen, we handle safe areas here
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        // Position overlay content within safe area boundaries
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {/* A4 aspect ratio scanning frame positioned within safe boundaries */}
      <div
        className="relative bg-white/10 rounded-xl"
        style={{
          width: "85vw",
          height: "calc(85vw * 1.414)", // A4 aspect ratio
          maxHeight: "90vh",
          maxWidth: "calc(90vh / 1.414)",
        }}
      >
        {/* 6 marker detection zones in a 3x2 grid */}
        <div className="absolute grid grid-cols-2 grid-rows-3 gap-0 inset-0">
          {zones.map((zone) => {
            const isDetected = detections.find((d) => d.id === zone.id);

            return (
              <div
                key={`zone-${zone.id}`}
                className={`relative transition-all duration-100 border ${
                  isDetected
                    ? `border-8 ${zone.highlightClass} border-green-400`
                    : `border-4 ${zone.defaultClass} border-white/20`
                }`}
              />
            );
          })}
        </div>

        {/* Instruction text centered within the scanning frame */}
        {/* <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            {currentExamType ? (
              <div className="space-y-2">
                <div className="text-green-400 text-xl font-bold">
                  ✅ {currentExamType.name}
                </div>
                <div className="text-white/80 text-sm">
                  {currentExamType.metadata?.totalQuestions} preguntas • {currentExamType.metadata?.answerOptions} opciones
                </div>
                <div className="text-white/60 text-lg">
                  Listo para escanear
                </div>
              </div>
            ) : (
              <div className="text-white/60 text-2xl font-bold">
                Alinea y enfoca el examen dentro del marco
              </div>
            )}
          </div>
        </div> */}

        {/* Processing overlay covers the entire scanning frame */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/40 text-4xl font-bold tracking-wider">
              {t("common.processing")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraOverlay;
