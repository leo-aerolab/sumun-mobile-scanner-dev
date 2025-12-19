import { ExamTemplate } from "./types";
import { ExamSignature } from "./examSignature";

// Template imports - we'll import these statically for now
// import examTemplate1x1 from "./examTemplate-1x1.json";
// import examTemplate1x2 from "./examTemplate-1x2.json";
// import examTemplate1x4 from "./examTemplate-1x4.json";
import examTemplateDiagnostic from "./examTemplate-diagnostic.json";
import examTemplateMicrotest from "./examTemplate-microtest.json";
import examTemplateBrazilMicrotest from "./examTemplate-brazil-microtest.json";
import examTemplateBrazilMicrotest2 from "./examTemplate-brazil-microtest-2.json";
import examTemplateBrazilMicrotest3 from "./examTemplate-brazil-microtest-3.json";

// Template registry mapping exam signature IDs to their templates
const TEMPLATE_REGISTRY: Record<string, ExamTemplate> = {
  // "sumun-exam-1x1": examTemplate1x1 as ExamTemplate,
  // "sumun-exam-1x2": examTemplate1x2 as ExamTemplate,
  // "sumun-exam-1x4": examTemplate1x4 as ExamTemplate,
  "sumun-exam-diagnostic": examTemplateDiagnostic as ExamTemplate,
  "sumun-exam-microtest": examTemplateMicrotest as ExamTemplate,
  "br-microtest": examTemplateBrazilMicrotest as ExamTemplate,
  "br-microtest-2": examTemplateBrazilMicrotest2 as ExamTemplate,
  "br-microtest-3": examTemplateBrazilMicrotest3 as ExamTemplate,
};

/**
 * Get the appropriate exam template based on exam signature
 */
export const getExamTemplate = (examSignature: ExamSignature): ExamTemplate => {
  const template = TEMPLATE_REGISTRY[examSignature.id];
  
  if (!template) {
    console.warn(`⚠️ No template found for exam type: ${examSignature.id}`);
    console.warn(`Available templates: ${Object.keys(TEMPLATE_REGISTRY).join(', ')}`);
    
    // Fallback to default template (1x1)
    console.log(`📋 Falling back to default template: sumun-exam-1x1`);
    return TEMPLATE_REGISTRY["sumun-exam-1x1"];
  }
  
  console.log(`✅ Using template for: ${examSignature.name} (${examSignature.id})`);
  return template;
};

/**
 * Get template by exam signature ID directly
 */
export const getExamTemplateById = (signatureId: string): ExamTemplate | null => {
  const template = TEMPLATE_REGISTRY[signatureId];
  
  if (!template) {
    console.warn(`⚠️ No template found for signature ID: ${signatureId}`);
    return null;
  }
  
  return template;
};

/**
 * Register a new template for an exam signature
 */
export const registerExamTemplate = (signatureId: string, template: ExamTemplate): void => {
  if (TEMPLATE_REGISTRY[signatureId]) {
    console.warn(`Template for ${signatureId} already exists, overwriting...`);
  }
  
  TEMPLATE_REGISTRY[signatureId] = template;
  console.log(`✅ Registered template for: ${signatureId}`);
};

/**
 * Get all available template IDs
 */
export const getAvailableTemplateIds = (): string[] => {
  return Object.keys(TEMPLATE_REGISTRY);
};

/**
 * Validate that a template matches the expected structure for an exam signature
 */
export const validateTemplate = (template: ExamTemplate, examSignature: ExamSignature): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if template has required properties
  if (!template.pageDimensions || template.pageDimensions.length !== 2) {
    errors.push("Missing or invalid pageDimensions");
  }
  
  if (!template.fieldBlocks || !Array.isArray(template.fieldBlocks)) {
    errors.push("Missing or invalid fieldBlocks");
  }
  
  // Calculate total questions from fieldBlocks
  const totalTemplateQuestions = template.fieldBlocks?.reduce(
    (sum, block) => sum + (block.numQuestions || 0), 
    0
  ) || 0;
  
  // Check if template questions match signature metadata
  if (examSignature.metadata?.totalQuestions !== undefined) {
    if (totalTemplateQuestions !== examSignature.metadata.totalQuestions) {
      warnings.push(
        `Template has ${totalTemplateQuestions} questions but signature expects ${examSignature.metadata.totalQuestions}`
      );
    }
  }
  
  // Check answer options consistency
  if (examSignature.metadata?.answerOptions !== undefined) {
    const templateOptions = template.fieldBlocks?.[0]?.numOptions;
    if (templateOptions && templateOptions !== examSignature.metadata.answerOptions) {
      warnings.push(
        `Template has ${templateOptions} answer options but signature expects ${examSignature.metadata.answerOptions}`
      );
    }
  }
  
  // Check if template has personal info blocks when signature expects them
  if (examSignature.metadata?.hasPersonalInfo && !template.visionBlock) {
    warnings.push("Signature expects personal info but template has no visionBlock");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Get template summary for debugging
 */
export const getTemplateSummary = (template: ExamTemplate): {
  totalQuestions: number;
  numBlocks: number;
  answerOptions: number[];
  hasPersonalInfo: boolean;
  dimensions: number[];
} => {
  const totalQuestions = template.fieldBlocks?.reduce(
    (sum, block) => sum + (block.numQuestions || 0), 
    0
  ) || 0;
  
  const answerOptions = template.fieldBlocks?.map(block => block.numOptions || 0) || [];
  const uniqueOptions = [...new Set(answerOptions)];
  
  return {
    totalQuestions,
    numBlocks: template.fieldBlocks?.length || 0,
    answerOptions: uniqueOptions,
    hasPersonalInfo: !!(template.visionBlock),
    dimensions: template.pageDimensions || [0, 0]
  };
}; 