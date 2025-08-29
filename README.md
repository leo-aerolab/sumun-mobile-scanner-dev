# Sumun Mobile Scanner

A mobile-first exam scanning application built with Next.js and OpenCV.js.

## Features

- Real-time camera scanning with ArUco marker detection
- Automatic exam type identification
- Bubble detection and scoring
- Personal information extraction using OCR
- Support for multiple exam templates
- **NEW: Exam Config System** - Separate questions/answers from templates

## Exam Config System

The scanner now supports a config-based approach where questions and answers are stored separately from exam templates. This allows different exams to use the same template but with different questions.

### Structure

```typescript
interface ExamConfig {
  examId: string;
  examName: string;
  templateId: string; // References the template to use
  questions: ExamQuestion[];
  metadata?: {
    totalQuestions?: number;
    answerOptions?: number;
    hasPersonalInfo?: boolean;
  };
}

interface ExamQuestion {
  name: string;
  correctAnswer: string;
  points: number;
}
```

### Usage

1. **Create an exam config** with questions and answers
2. **Reference a template** using `templateId`
3. **Pass the config ID** to the CameraScanner component (optional)

```tsx
<CameraScanner examConfigId="my-exam-1" />
```

### Workflow

The scanner follows a specific workflow:

1. **User selects test** on the native side
2. **Native app injects** exam config with questions/answers and template ID
3. **Scanner validates** that detected exam type matches expected template
4. **Scanner uses** injected questions/answers, not template questions
5. **Fallback** to mock configs for development/testing

### Mock Configs

The system includes mock exam configurations for testing:

- `mock-diagnostic-1`: Diagnostic exam (10 questions, 1 point each) - uses 1x2 template
- `mock-microtest-1`: Microtest (5 questions, 2 points each) - uses 1x4 template

### Webview Integration

When running in a React Native WebView, the scanner expects the exam config to be injected via:

```javascript
// In React Native - after user selects a test
const examConfig = {
  examId: "my-exam-1",
  examName: "Mathematics Final",
  templateId: "sumun-exam-1x1", // Must match the actual exam template
  questions: [
    { name: "Question 1", correctAnswer: "A", points: 1 },
    // ... more questions
  ]
};

// Inject into webview
webviewRef.current.injectJavaScript(`
  window.ReactNativeWebView.injectedObjectJson = () => JSON.stringify({
    examConfig: ${JSON.stringify(examConfig)}
  });
`);
```

**Important**: The `templateId` in the injected config must match the actual exam template being scanned.

### Validation

The system validates exam configs against templates to ensure:
- Question count matches template capacity
- Answer options are consistent
- All required properties are present

## Development

```bash
npm install
npm run dev
```

## License

MIT
