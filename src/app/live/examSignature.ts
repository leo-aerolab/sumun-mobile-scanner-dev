import { Detection } from "./markerDetection";

export interface ExamSignature {
  id: string;
  name: string;
  description: string;
  markerIds: number[];
  layoutType: string;
  version: string;
  // Additional metadata for exam-specific processing
  metadata?: {
    totalQuestions?: number;
    questionsPerPage?: number;
    answerOptions?: number;
    hasPersonalInfo?: boolean;
  };
}

// Define known exam signatures
export const EXAM_SIGNATURES: ExamSignature[] = [
  // {
  //   id: "sumun-exam-1x1", 
  //   name: "Sumun Exam 1x1",
  //   description: "1 exam per page, 30 questions",
  //   markerIds: [22, 10, 30, 41, 34, 15], // Current configuration
  //   layoutType: "3x2-grid",
  //   version: "1.0",
  //   metadata: {
  //     totalQuestions: 30,
  //     questionsPerPage: 30,
  //     answerOptions: 5,
  //     hasPersonalInfo: true,
  //   }
  // },
  {
    id: "sumun-exam-diagnostic", 
    name: "Diagnostic", 
    description: "1 exam per page, 10 questions",
    markerIds: [7, 8, 9, 10, 11, 12], // Based on image markers
    layoutType: "3x2-grid",
    version: "1.0",
    metadata: {
      totalQuestions: 10,
      questionsPerPage: 10,
      answerOptions: 4,
      hasPersonalInfo: true,
    }
  },
  {
    id: "sumun-exam-microtest", 
    name: "Microtest", 
    description: "1 exam per page, 5 questions",
    markerIds: [1, 2, 3, 4, 5, 6], // Based on image markers
    layoutType: "3x2-grid",
    version: "1.0",
    metadata: {
      totalQuestions: 5,
      questionsPerPage: 5,
      answerOptions: 4,
      hasPersonalInfo: true,
    }
  }
];

/**
 * Generate a signature hash from detected ArUco marker IDs
 * This creates a unique fingerprint for the exam type
 */
export const generateExamSignature = (detections: Detection[]): string => {
  // Sort marker IDs to ensure consistent signature regardless of detection order
  const sortedIds = detections
    .map(d => d.id)
    .sort((a, b) => a - b);
  
  // Create a hash-like signature from the sorted IDs
  const signature = sortedIds.join('-');
  return signature;
};

/**
 * Identify exam type based on detected ArUco markers
 */
export const identifyExamType = (detections: Detection[]): ExamSignature | null => {
  if (detections.length !== 6) {
    console.warn(`Expected 6 markers for exam identification, got ${detections.length}`);
    return null;
  }

  const detectedIds = detections.map(d => d.id).sort((a, b) => a - b);
  
  // Find matching exam signature
  for (const signature of EXAM_SIGNATURES) {
    const signatureIds = [...signature.markerIds].sort((a, b) => a - b);
    
    // Check if detected IDs match this signature exactly
    if (arraysEqual(detectedIds, signatureIds)) {
      console.log(`✅ Exam identified: ${signature.name} (${signature.id})`);
      console.log(`📋 Metadata:`, signature.metadata);
      return signature;
    }
  }

  // No matching signature found
  const unknownSignature = generateExamSignature(detections);
  console.warn(`❌ Unknown exam type detected with signature: ${unknownSignature}`);
  console.warn(`Detected marker IDs: [${detectedIds.join(', ')}]`);
  
  return null;
};

/**
 * Validate that detected markers form a valid exam signature
 */
export const validateExamSignature = (detections: Detection[]): {
  isValid: boolean;
  examType?: ExamSignature;
  signature: string;
  errors: string[];
} => {
  const errors: string[] = [];
  const signature = generateExamSignature(detections);
  
  // Check marker count
  if (detections.length !== 6) {
    errors.push(`Invalid marker count: expected 6, got ${detections.length}`);
  }
  
  // Check for duplicate marker IDs
  const ids = detections.map(d => d.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push(`Duplicate marker IDs detected: [${ids.join(', ')}]`);
  }
  
  // Try to identify exam type
  const examType = identifyExamType(detections);
  
  if (!examType) {
    errors.push(`Unknown exam type with signature: ${signature}`);
  }
  
  return {
    isValid: errors.length === 0,
    examType: examType || undefined,
    signature,
    errors
  };
};

/**
 * Register a new exam signature
 */
export const registerExamSignature = (signature: ExamSignature): void => {
  // Check if signature already exists
  const existing = EXAM_SIGNATURES.find(s => s.id === signature.id);
  if (existing) {
    console.warn(`Exam signature ${signature.id} already exists, skipping registration`);
    return;
  }
  
  // Validate marker configuration
  if (signature.markerIds.length !== 6) {
    throw new Error(`Invalid marker configuration: expected 6 markers, got ${signature.markerIds.length}`);
  }
  
  // Check for unique marker IDs
  const uniqueIds = new Set(signature.markerIds);
  if (uniqueIds.size !== signature.markerIds.length) {
    throw new Error(`Duplicate marker IDs in signature: [${signature.markerIds.join(', ')}]`);
  }
  
  EXAM_SIGNATURES.push(signature);
  console.log(`✅ Registered new exam signature: ${signature.name} (${signature.id})`);
};

/**
 * Get all registered exam signatures
 */
export const getRegisteredSignatures = (): ExamSignature[] => {
  return [...EXAM_SIGNATURES];
};

/**
 * Utility function to compare arrays for equality
 */
const arraysEqual = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Get exam signature by ID
 */
export const getExamSignatureById = (id: string): ExamSignature | null => {
  return EXAM_SIGNATURES.find(s => s.id === id) || null;
};

/**
 * Create a visual representation of the marker layout for debugging
 */
export const visualizeMarkerLayout = (detections: Detection[]): string => {
  if (detections.length !== 6) {
    return `Invalid layout: ${detections.length} markers detected`;
  }
  
  // Sort markers by position to create a visual grid
  const sorted = [...detections].sort((a, b) => {
    const yDiff = a.center[1] - b.center[1];
    if (Math.abs(yDiff) > 50) return yDiff; // Different rows
    return a.center[0] - b.center[0]; // Same row
  });
  
  const layout = `
┌─────────────────────┐
│  ${sorted[0].id.toString().padStart(2)}        ${sorted[1].id.toString().padStart(2)}  │
│                     │
│  ${sorted[2].id.toString().padStart(2)}        ${sorted[3].id.toString().padStart(2)}  │
│                     │
│  ${sorted[4].id.toString().padStart(2)}        ${sorted[5].id.toString().padStart(2)}  │
└─────────────────────┘
  `;
  
  return layout;
}; 