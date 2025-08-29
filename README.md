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

### Config Sources

The scanner can get exam configs from multiple sources:

1. **Webview Injection** (Primary): Config injected by parent webview via `window.ReactNativeWebView.injectedObjectJson()`
2. **Dynamic Selection**: Automatically finds matching config for detected exam type
3. **Mock Fallback**: Uses mock configs when no injection or dynamic match available

### Dynamic Config Selection

The scanner automatically selects the appropriate exam config based on the detected exam type:

1. **Detects exam type** from ArUco markers
2. **Finds matching config** for the detected template
3. **Falls back** to injected/webview config if no dynamic match found
4. **Validates** the config against the template

### Mock Configs

The system includes mock exam configurations for testing:

- `mock-diagnostic-1`: Diagnostic exam (10 questions, 1 point each) - uses 1x2 template
- `mock-microtest-1`: Microtest (5 questions, 2 points each) - uses 1x4 template

### Webview Integration

When running in a React Native WebView, the scanner expects the exam config to be injected via:

```javascript
// In React Native
const examConfig = {
  examId: "my-exam-1",
  examName: "Mathematics Final",
  templateId: "sumun-exam-1x1",
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
