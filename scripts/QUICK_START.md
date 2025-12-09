# Quick Start: Generating ArUco Markers

## Prerequisites

```bash
pip install opencv-python opencv-contrib-python
```

## Generate Markers for a New Exam Type

### Step 1: Choose Marker IDs

Check which IDs are available:
- Currently used: 1-18 (Microtest, Diagnostic, Brazil Microtest)
- Available: 19-49

Choose 6 consecutive IDs, e.g., `[19, 20, 21, 22, 23, 24]`

### Step 2: Generate the Markers

```bash
python scripts/generate_aruco_markers.py \
  --ids 19,20,21,22,23,24 \
  --size 200 \
  --output markers/new-exam \
  --name new-exam
```

This creates:
- `markers/new-exam/aruco_new-exam_id19.png`
- `markers/new-exam/aruco_new-exam_id20.png`
- ... (6 files total)

### Step 3: Register in Code

Add to `src/app/live/examSignature.ts`:

```typescript
{
  id: "new-exam-id",
  name: "New Exam Type",
  description: "Description of the exam",
  markerIds: [19, 20, 21, 22, 23, 24],
  layoutType: "3x2-grid",
  version: "1.0",
  metadata: {
    totalQuestions: 10,
    questionsPerPage: 10,
    answerOptions: 4,
    hasPersonalInfo: true,
  }
}
```

### Step 4: Print and Test

1. Print the markers at ~20-30mm size
2. Place them on the exam sheet in a 3x2 grid
3. Scan with the mobile app
4. Verify the exam type is correctly identified

## Common Commands

```bash
# Generate all markers from config
python scripts/generate_aruco_markers.py --config scripts/markers_config.json

# Generate with custom size (larger for better detection)
python scripts/generate_aruco_markers.py --ids 1,2,3,4,5,6 --size 300 --output markers/

# Generate with larger margin for printing
python scripts/generate_aruco_markers.py --ids 1,2,3,4,5,6 --size 200 --margin 30
```

## Troubleshooting

**Markers not detected?**
- Check print quality (300+ DPI recommended)
- Verify marker size (~20-30mm)
- Ensure high contrast (black/white)
- Check that IDs match the dictionary (0-49 for DICT_4X4_50)

**Wrong exam type identified?**
- Verify marker IDs in `examSignature.ts` match printed markers
- Check console logs for detected IDs
- Ensure all 6 markers are visible in the camera frame
