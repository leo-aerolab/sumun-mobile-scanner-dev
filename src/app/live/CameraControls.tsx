import React from "react";
import { CameraSwitchIcon } from "./CameraSwitchIcon";

interface CameraControlsProps {
  isMobile: boolean;
  isProcessing: boolean;
  showControls: boolean;
  onSwitchCamera: () => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  isMobile,
  isProcessing,
  showControls,
  onSwitchCamera,
}) => {
  if (!isMobile || !showControls) {
    return null;
  }

  return (
    <button
      onClick={onSwitchCamera}
      className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-full z-40 hover:bg-black/70 transition-colors"
      disabled={isProcessing}
      style={{
        top: "max(1rem, env(safe-area-inset-top))",
        right: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <CameraSwitchIcon />
    </button>
  );
};

export default CameraControls;
