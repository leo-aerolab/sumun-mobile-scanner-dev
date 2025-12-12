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
}

interface ExamQuestion {
  id: string;
  label: string;
  correctAnswer: string;
  points: number;
}
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

- `mock-diagnostic-local`: Diagnostic exam (10 questions, 1 point each) - uses 1x2 template
- `mock-microtest-local`: Microtest (5 questions, 2 points each) - uses 1x4 template

### Webview Integration

When running in a React Native WebView, the scanner expects the exam config to be injected via:

```javascript
// In React Native - after user selects a test
const examConfig = {
  examId: "my-exam-1",
  examName: "Mathematics 1",
  templateId: "sumun-exam-microtest", // Must match the actual exam template
  questions: [
    { id: "q1", label: "Question 1", correctAnswer: "A", points: 1 },
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

## ArUco Marker System

The scanner uses **ArUco markers** (DICT_4X4_50) to identify exam types and perform perspective correction. Each exam sheet has 6 markers arranged in a 3x2 grid.

### Marker ID Strategy

Each exam type uses a unique set of 6 consecutive marker IDs:

| Exam Type | Marker IDs | Status |
|-----------|-----------|--------|
| Microtest | [1, 2, 3, 4, 5, 6] | ✅ Active |
| Diagnostic | [7, 8, 9, 10, 11, 12] | ✅ Active |
| Brazil Microtest | [13, 14, 15, 16, 17, 18] | ⚠️ Placeholder |
| Reserved | [19-24] | 🔒 Available |
| Reserved | [25-30] | 🔒 Available |
| Reserved | [31-49] | 🔒 Available |

**Dictionary**: `DICT_4X4_50` (supports IDs 0-49)

### Generating New Markers

To generate ArUco markers for a new exam type:

1. **Install Python dependencies**:
   ```bash
   pip install opencv-python opencv-contrib-python
   ```

2. **Generate markers**:
   ```bash
   # Single exam type
   python scripts/generate_aruco_markers.py \
     --ids 19,20,21,22,23,24 \
     --size 200 \
     --output markers/new-exam \
     --name new-exam
   
   # Or generate all from config
   python scripts/generate_aruco_markers.py --config scripts/markers_config.json
   ```

3. **Register the new exam signature** in `src/app/live/examSignature.ts`:
   ```typescript
   {
     id: "new-exam-id",
     name: "New Exam Type",
     description: "Description",
     markerIds: [19, 20, 21, 22, 23, 24],
     layoutType: "3x2-grid",
     version: "1.0",
     metadata: { /* ... */ }
   }
   ```

See `scripts/README.md` for detailed documentation on marker generation.

### How Exam Type Detection Works

1. **Detection**: The scanner detects all ArUco markers in the camera feed using `DICT_4X4_50`
2. **Identification**: When exactly 6 markers are detected, it matches the set of IDs against known exam signatures
3. **Validation**: The detected exam type is validated against the expected template from the exam config
4. **Processing**: The appropriate template is used for bubble detection and scoring

The detection logic is in `src/app/live/examSignature.ts` - the `identifyExamType()` function matches detected marker IDs against the `EXAM_SIGNATURES` array.

## Development

```bash
npm install
npm run dev
```

## License

MIT
