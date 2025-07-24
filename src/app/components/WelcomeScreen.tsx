"use client";

import React from "react";
import { CameraInstructions } from "../live/CameraInstructions";
import Orb from "../ui/Orb/Orb";
import Image from "next/image";

interface WelcomeScreenProps {
  onStart?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [started, setStarted] = React.useState(false);

  const handleStart = () => {
    setStarted(true);
    if (onStart) {
      onStart();
    }
  };

  // If started, show the camera onboarding
  if (started) {
    return <CameraInstructions />;
  }

  return (
    <div className="h-[90vh] w-full flex flex-col bg-gray-900 py-safe">
      {/* Main content area - centered vertically */}
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <div className="max-w-96 max-h-96 h-full w-full relative">
          <div className="w-full h-full relative aspect-square">
            <Orb
              hoverIntensity={0}
              rotateOnHover={false}
              hue={0}
              forceHoverState={false}
            />
          </div>
          <div className="w-full h-full absolute top-0 left-0 flex items-center justify-center">
            <Image
              src="/assets/logo-sumun.svg"
              width={500}
              height={500}
              className="w-full h-auto block m-auto"
              alt="Sumun"
              priority
            />
          </div>
        </div>
        <div className="text-white text-2xl font-bold">Demo Evaluador</div>
      </div>

      {/* Start button pinned at bottom */}
      <div className="p-4">
        <button
          onClick={handleStart}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold text-lg py-4 px-8 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-101 focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-opacity-50"
        >
          Comenzar
        </button>
      </div>
    </div>
  );
};
