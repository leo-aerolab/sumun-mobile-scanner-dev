# ArUco Marker System - Implementation Summary

## Overview

This document summarizes the ArUco marker system for exam type identification in the Sumun Mobile Scanner.

## Current Implementation

### ArUco Dictionary
- **Dictionary**: `DICT_4X4_50` (defined in `src/app/live/markerDetection.ts`)
- **ID Range**: 0-49 (50 possible markers)
- **Layout**: 6 markers per exam sheet in a 3x2 grid

### Current Exam Types

| Exam Type | Signature ID | Marker IDs | Status |
|-----------|--------------|------------|--------|
| Microtest | `sumun-exam-microtest` | [1, 2, 3, 4, 5, 6] | ✅ Active |
| Diagnostic | `sumun-exam-diagnostic` | [7, 8, 9, 10, 11, 12] | ✅ Active |
| Brazil Microtest | `br-microtest` | [13, 14, 15, 16, 17, 18] | ⚠️ Placeholder |

### Detection Flow

1. **Real-time Detection** (`CameraScanner.tsx`):
   - Continuously detects ArUco markers in camera feed
   - When 6 markers detected → triggers exam type identification

2. **Exam Type Identification** (`examSignature.ts`):
   - `identifyExamType()` matches detected IDs against `EXAM_SIGNATURES`
   - Returns matching `ExamSignature` or `null` if unknown

3. **Validation** (`CameraScanner.tsx`):
   - Validates detected exam type matches expected template from exam config
   - Shows error if mismatch detected

4. **Image Processing** (`imageCapture.ts`):
   - Uses detected markers for perspective correction
   - Organizes markers into 3x2 grid for transformation

## ID Strategy

**Approach**: Each exam type uses 6 consecutive marker IDs.

**Rationale**:
- Simple to manage and remember
- Easy to verify no conflicts
- Clear allocation pattern
- Sufficient capacity (50 IDs = ~8 exam types)

**Allocation**:
- IDs 1-18: Currently assigned (3 exam types)
- IDs 19-49: Available for new exam types (31 IDs = ~5 more exam types)

## Marker Generator

### Location
`scripts/generate_aruco_markers.py`

### Features
- Generates markers using the same dictionary (`DICT_4X4_50`)
- Configurable size, margin, and border
- Supports single exam type or batch generation via config
- Outputs high-quality PNG files ready for printing

### Usage Examples

```bash
# Generate markers for a new exam type
python scripts/generate_aruco_markers.py \
  --ids 19,20,21,22,23,24 \
  --size 200 \
  --output markers/new-exam \
  --name new-exam

# Generate all markers from config
python scripts/generate_aruco_markers.py --config scripts/markers_config.json
```

See `scripts/README.md` for complete documentation.

## Adding a New Exam Type

### Step-by-Step Process

1. **Choose 6 consecutive marker IDs** (e.g., 19-24)
   - Check `scripts/markers_config.json` for available ranges
   - Use `checkMarkerIdConflict()` in code to verify

2. **Generate the markers**:
   ```bash
   python scripts/generate_aruco_markers.py \
     --ids 19,20,21,22,23,24 \
     --size 200 \
     --output markers/new-exam \
     --name new-exam
   ```

3. **Register in `src/app/live/examSignature.ts`**:
   ```typescript
   {
     id: "new-exam-id",
     name: "New Exam Type",
     description: "Description",
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

4. **Add template** (if needed) in `src/app/live/examTemplateManager.ts`

5. **Update config** in `scripts/markers_config.json` to document the new set

6. **Print and test**:
   - Print markers at ~20-30mm size
   - Place on exam sheet in 3x2 grid
   - Scan and verify identification

## Helper Functions

### `checkMarkerIdConflict(markerIds: number[])`
Checks if proposed marker IDs conflict with existing exam signatures.

```typescript
const conflict = checkMarkerIdConflict([19, 20, 21, 22, 23, 24]);
if (conflict.hasConflict) {
  console.error("Conflicts with:", conflict.conflictingSignatures);
}
```

### `getAllUsedMarkerIds()`
Returns all marker IDs currently in use across all exam signatures.

```typescript
const usedIds = getAllUsedMarkerIds();
// Returns: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
```

## File Structure

```
scripts/
├── generate_aruco_markers.py  # Marker generator script
├── markers_config.json        # Configuration for batch generation
├── README.md                  # Detailed documentation
└── QUICK_START.md            # Quick reference guide

src/app/live/
├── examSignature.ts          # Exam type identification logic
├── markerDetection.ts        # ArUco detection (uses DICT_4X4_50)
└── CameraScanner.tsx         # Main scanner component
```

## Printing Guidelines

1. **Size**: 20-30mm per side (0.8-1.2 inches)
2. **Resolution**: 300+ DPI for best detection
3. **Contrast**: High contrast black/white required
4. **Placement**: 3x2 grid layout:
   ```
   [Top-Left]     [Top-Right]
   [Center-Left]  [Center-Right]
   [Bottom-Left]  [Bottom-Right]
   ```
5. **Quality**: Avoid damage, distortion, or low-contrast printing

## Troubleshooting

### Markers Not Detected
- ✅ Check print quality and contrast
- ✅ Verify marker size (~20-30mm)
- ✅ Ensure all 6 markers are visible
- ✅ Check dictionary matches (DICT_4X4_50)

### Wrong Exam Type Identified
- ✅ Verify marker IDs in `examSignature.ts` match printed markers
- ✅ Check console logs for detected IDs
- ✅ Use `checkMarkerIdConflict()` to verify no overlaps

### Unknown Exam Type Warning
- ✅ Add new signature to `EXAM_SIGNATURES` array
- ✅ Ensure marker IDs are sorted correctly
- ✅ Verify all 6 markers are detected

## Backward Compatibility

✅ **All existing functionality is preserved**:
- Current exam types (Microtest, Diagnostic) continue to work
- Detection logic unchanged, only extended
- No breaking changes to existing templates or configs

## Future Enhancements

Potential improvements:
- [ ] Visual marker placement guide/template
- [ ] Automated marker validation tool
- [ ] Marker quality checker (contrast, size verification)
- [ ] Support for different marker sizes per exam type
