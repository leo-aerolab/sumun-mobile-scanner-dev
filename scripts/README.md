# ArUco Marker Generation

This directory contains tools for generating ArUco markers used on exam sheets.

## Overview

The scanner uses **ArUco DICT_4X4_50** dictionary, which supports marker IDs from 0 to 49. Each exam type is identified by a unique set of 6 markers arranged in a 3x2 grid.

## Marker ID Strategy

Each exam type uses a unique set of 6 consecutive marker IDs:

| Exam Type | Marker IDs | Status |
|-----------|-----------|--------|
| Microtest | [1, 2, 3, 4, 5, 6] | ✅ Active |
| Diagnostic | [7, 8, 9, 10, 11, 12] | ✅ Active |
| Brazil Microtest | [13, 14, 15, 16, 17, 18] | ⚠️ Placeholder |
| Reserved | [19-24] | 🔒 Available |
| Reserved | [25-30] | 🔒 Available |
| Reserved | [31-49] | 🔒 Available |

**Important**: When creating a new exam type, choose 6 consecutive IDs that are not already in use.

## Requirements

The marker generator requires Python 3.6+ and OpenCV:

```bash
pip install opencv-python opencv-contrib-python
```

## Usage

### Quick Start: Generate Markers for a Single Exam Type

```bash
# Generate markers with IDs 1-6 for Microtest
python scripts/generate_aruco_markers.py \
  --ids 1,2,3,4,5,6 \
  --size 200 \
  --output markers/microtest \
  --name microtest
```

### Generate All Markers from Config

```bash
# Generate all marker sets defined in config
python scripts/generate_aruco_markers.py --config scripts/markers_config.json
```

### Command-Line Options

- `--ids`: Comma-separated list of marker IDs (e.g., `1,2,3,4,5,6`)
- `--size`: Marker size in pixels (default: 200)
- `--margin`: White margin around marker in pixels (default: 20)
- `--border-bits`: Number of border bits (default: 1)
- `--output`: Output directory (default: `markers`)
- `--name`: Name prefix for generated files (default: `marker`)
- `--config`: Path to JSON configuration file (overrides other arguments)

### Configuration File Format

You can define multiple marker sets in a JSON file:

```json
{
  "markerSize": 200,
  "borderBits": 1,
  "margin": 20,
  "outputDir": "markers",
  "markerSets": [
    {
      "name": "microtest",
      "ids": [1, 2, 3, 4, 5, 6],
      "description": "Microtest exam markers"
    }
  ]
}
```

## Output

The script generates PNG images named `aruco_{name}_id{ID:02d}.png`:

- `aruco_microtest_id01.png`
- `aruco_microtest_id02.png`
- etc.

Each marker image includes:
- The ArUco marker pattern (black and white squares)
- A white border/margin for printing

## Printing Guidelines

1. **Size**: Markers should be printed at approximately 20-30mm (0.8-1.2 inches) per side
2. **Quality**: Print at high resolution (300+ DPI) for best detection
3. **Placement**: Markers should be placed at the corners and edges of the exam sheet in a 3x2 grid:
   ```
   [Top-Left]     [Top-Right]
   [Center-Left]  [Center-Right]
   [Bottom-Left] [Bottom-Right]
   ```
4. **Contrast**: Ensure high contrast between black and white areas
5. **Distortion**: Avoid printing markers on curved surfaces or at extreme angles

## Adding a New Exam Type

1. **Choose 6 consecutive marker IDs** that are not in use (check `scripts/markers_config.json`)

2. **Generate the markers**:
   ```bash
   python scripts/generate_aruco_markers.py \
     --ids 19,20,21,22,23,24 \
     --size 200 \
     --output markers/new-exam-type \
     --name new-exam-type
   ```

3. **Update the exam signature** in `src/app/live/examSignature.ts`:
   ```typescript
   {
     id: "new-exam-type-id",
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

4. **Add the exam template** in `src/app/live/examTemplateManager.ts` if needed

5. **Update the config file** (`scripts/markers_config.json`) to document the new marker set

## Verification

After printing markers, verify they work by:

1. Scanning a test sheet with the mobile scanner
2. Checking the console logs for detected marker IDs
3. Ensuring the exam type is correctly identified

If markers are not detected:
- Check print quality and contrast
- Verify marker size (should be ~20-30mm)
- Ensure markers are not damaged or obscured
- Check that the correct ArUco dictionary is being used (DICT_4X4_50)
