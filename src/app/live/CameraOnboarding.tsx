"use client";

import React, { useState, useEffect } from "react";
import { CameraScanner } from "./CameraScanner";

export const CameraOnboarding: React.FC = () => {
  const [permissionState, setPermissionState] = useState<
    "initial" | "requesting" | "granted" | "denied"
  >("initial");
  const [error, setError] = useState<string>("");

  // Check permission status without triggering prompt
  const checkPermissionStatus = async (): Promise<
    "granted" | "denied" | "prompt"
  > => {
    try {
      // Check if Permissions API is available
      if ("permissions" in navigator && "query" in navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        return permissionStatus.state as "granted" | "denied" | "prompt";
      }

      // Fallback: check if mediaDevices API is available
      if (!("mediaDevices" in navigator) || !navigator.mediaDevices) {
        return "denied"; // API not supported
      }

      // Try to get existing stream without constraints to avoid prompt
      // This only works if permission was previously granted
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(
          (device: MediaDeviceInfo) => device.kind === "videoinput"
        );
        if (!hasCamera) {
          return "denied"; // No camera found
        }

        // Try to access without specific constraints (less likely to prompt)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        return "granted";
      } catch {
        return "prompt"; // Assume we need to ask
      }
    } catch (error) {
      console.warn("Could not check camera permission:", error);
      return "prompt"; // Default to showing prompt
    }
  };

  // Check permission on component mount
  useEffect(() => {
    const initializePermissionCheck = async () => {
      const status = await checkPermissionStatus();

      switch (status) {
        case "granted":
          setPermissionState("granted");
          break;
        case "denied":
          setPermissionState("denied");
          setError(
            "Camera access was previously denied. Please allow camera access in your browser settings."
          );
          break;
        case "prompt":
        default:
          setPermissionState("initial");
          break;
      }
    };

    initializePermissionCheck();
  }, []);

  const requestPermission = async () => {
    setPermissionState("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setPermissionState("granted");
    } catch (error) {
      setPermissionState("denied");
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setError(
            "Camera access was denied. Please allow camera access in your browser settings and try again."
          );
        } else if (error.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else if (error.name === "NotSupportedError") {
          setError("Camera access is not supported in this browser.");
        } else {
          setError(`Camera error: ${error.message}`);
        }
      } else {
        setError("An unknown error occurred while accessing the camera.");
      }
    }
  };

  // If permission is granted, render the CameraScanner
  if (permissionState === "granted") {
    return <CameraScanner />;
  }

  return (
    // Camera permission onboarding screen
    // Safe area handling: This uses standard padding and margins that work well
    // within the safe area boundaries set by the parent layout
    // The centered modal design naturally avoids safe area conflicts
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sumun Check</h1>
          <p className="text-gray-600">
            Necesitamos acceder a tu cámara para escanear los exámenes.
          </p>
        </div>

        {permissionState === "initial" && (
          <>
            <p className="text-gray-600 mb-6">
              Hacé clic en el botón de abajo para permitir el acceso a la
              cámara.
            </p>
            <button
              onClick={requestPermission}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Permitir acceso a la cámara
            </button>
          </>
        )}

        {permissionState === "requesting" && (
          <>
            <div className="mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
            <p className="text-gray-600">
              Esperá un momento... Estamos pidiendo acceso a la cámara.
            </p>
          </>
        )}

        {permissionState === "denied" && (
          <>
            <div className="mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-6 h-6 text-red-600"
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
            </div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              No pudimos acceder a tu cámara.
            </h3>
            {error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded">
                {error}
              </p>
            )}
            <button
              onClick={requestPermission}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Intentar de nuevo
            </button>
          </>
        )}
      </div>
    </div>
  );
};
