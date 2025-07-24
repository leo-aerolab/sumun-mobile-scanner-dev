"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Detection } from "./markerDetection";

interface Camera3DProps {
  detections: Detection[];
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
}

// Helper function to extract 4 corner markers by their specific IDs
const getCornerMarkers = (detections: Detection[]) => {
  const topLeft = detections.find((d) => d.id === 47);
  const topRight = detections.find((d) => d.id === 10);
  const bottomLeft = detections.find((d) => d.id === 34);
  const bottomRight = detections.find((d) => d.id === 15);

  if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
    return null;
  }

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  };
};

// Helper function to calculate 3D position from 2D marker position
const calculate3DPosition = (
  marker: Detection,
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
  _camera: THREE.Camera,
  z: number = 0
): THREE.Vector3 => {
  // Calculate how the video is displayed with object-cover
  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;

  let scaledVideoWidth, scaledVideoHeight;
  let offsetX = 0,
    offsetY = 0;

  if (videoAspect > displayAspect) {
    // Video is wider - will be cropped horizontally
    scaledVideoHeight = displayHeight;
    scaledVideoWidth = displayHeight * videoAspect;
    offsetX = (scaledVideoWidth - displayWidth) / 2;
  } else {
    // Video is taller - will be cropped vertically
    scaledVideoWidth = displayWidth;
    scaledVideoHeight = displayWidth / videoAspect;
    offsetY = (scaledVideoHeight - displayHeight) / 2;
  }

  // Scale marker coordinates from video space to display space
  const scaleX = scaledVideoWidth / videoWidth;
  const scaleY = scaledVideoHeight / videoHeight;

  const displayX = marker.center[0] * scaleX - offsetX;
  const displayY = marker.center[1] * scaleY - offsetY;

  // Convert to 3D coordinates (center at origin)
  const x = displayX - displayWidth / 2;
  const y = -(displayY - displayHeight / 2); // Flip Y

  return new THREE.Vector3(x, y, z);
};

// Component for the green plane
const GreenPlane: React.FC<{
  corners: {
    topLeft: Detection;
    topRight: Detection;
    bottomLeft: Detection;
    bottomRight: Detection;
  };
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
}> = ({ corners, videoWidth, videoHeight, displayWidth, displayHeight }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  // Calculate 3D positions for the corners
  const positions = useMemo(() => {
    return {
      topLeft: calculate3DPosition(
        corners.topLeft,
        videoWidth,
        videoHeight,
        displayWidth,
        displayHeight,
        camera
      ),
      topRight: calculate3DPosition(
        corners.topRight,
        videoWidth,
        videoHeight,
        displayWidth,
        displayHeight,
        camera
      ),
      bottomLeft: calculate3DPosition(
        corners.bottomLeft,
        videoWidth,
        videoHeight,
        displayWidth,
        displayHeight,
        camera
      ),
      bottomRight: calculate3DPosition(
        corners.bottomRight,
        videoWidth,
        videoHeight,
        displayWidth,
        displayHeight,
        camera
      ),
    };
  }, [corners, videoWidth, videoHeight, displayWidth, displayHeight, camera]);

  // Create geometry from the 4 corner points
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();

    // Define vertices for two triangles that form the quad
    const vertices = new Float32Array([
      // First triangle: topLeft -> bottomLeft -> topRight
      positions.topLeft.x,
      positions.topLeft.y,
      positions.topLeft.z,
      positions.bottomLeft.x,
      positions.bottomLeft.y,
      positions.bottomLeft.z,
      positions.topRight.x,
      positions.topRight.y,
      positions.topRight.z,

      // Second triangle: topRight -> bottomLeft -> bottomRight
      positions.topRight.x,
      positions.topRight.y,
      positions.topRight.z,
      positions.bottomLeft.x,
      positions.bottomLeft.y,
      positions.bottomLeft.z,
      positions.bottomRight.x,
      positions.bottomRight.y,
      positions.bottomRight.z,
    ]);

    geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    return geom;
  }, [positions]);

  // Animate the plane with a subtle pulse effect
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(time * 2) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color="#00ff00"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Component to set up the camera to match the perspective
const CameraController: React.FC<{
  displayWidth: number;
  displayHeight: number;
}> = ({ displayWidth, displayHeight }) => {
  const { gl, set } = useThree();

  useEffect(() => {
    // Create orthographic camera that maps 1:1 with display pixels
    const orthoCam = new THREE.OrthographicCamera(
      -displayWidth / 2, // left
      displayWidth / 2, // right
      displayHeight / 2, // top
      -displayHeight / 2, // bottom
      -1000, // near
      1000 // far
    );

    orthoCam.position.set(0, 0, 100);
    orthoCam.lookAt(0, 0, 0);
    orthoCam.updateProjectionMatrix();

    // Set the new camera
    set({ camera: orthoCam });

    // Set the canvas size
    gl.setSize(displayWidth, displayHeight, false);
  }, [gl, displayWidth, displayHeight, set]);

  return null;
};

// Main Camera3D component
const Camera3D: React.FC<Camera3DProps> = ({
  detections,
  videoWidth,
  videoHeight,
  displayWidth,
  displayHeight,
}) => {
  const [corners, setCorners] = useState<{
    topLeft: Detection;
    topRight: Detection;
    bottomLeft: Detection;
    bottomRight: Detection;
  } | null>(null);

  useEffect(() => {
    if (detections.length >= 4) {
      const cornerMarkers = getCornerMarkers(detections);
      setCorners(cornerMarkers);
    } else {
      setCorners(null);
    }
  }, [detections]);

  return (
    // 3D overlay covers the full display area
    // This component renders the green plane overlay when corner markers are detected
    // It uses absolute positioning to cover the entire video display area
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        width: displayWidth,
        height: displayHeight,
        zIndex: 10,
      }}
    >
      <Canvas
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
      >
        <CameraController
          displayWidth={displayWidth}
          displayHeight={displayHeight}
        />

        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        {corners && (
          <GreenPlane
            corners={corners}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
          />
        )}
      </Canvas>
    </div>
  );
};

export default Camera3D;
