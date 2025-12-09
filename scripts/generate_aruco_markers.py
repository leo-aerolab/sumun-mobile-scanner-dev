#!/usr/bin/env python3
"""
ArUco Marker Generator for Sumun Mobile Scanner

This script generates ArUco markers for exam sheets using the same dictionary
(DICT_4X4_50) that the scanner uses for detection.

Usage:
    python scripts/generate_aruco_markers.py --ids 1,2,3,4,5,6 --size 200 --output markers/
    python scripts/generate_aruco_markers.py --config markers_config.json

Configuration:
    You can define marker sets in a JSON config file:
    {
        "markerSize": 200,
        "borderBits": 1,
        "outputDir": "markers",
        "markerSets": [
            {
                "name": "microtest",
                "ids": [1, 2, 3, 4, 5, 6],
                "description": "Microtest exam markers"
            },
            {
                "name": "diagnostic",
                "ids": [7, 8, 9, 10, 11, 12],
                "description": "Diagnostic exam markers"
            }
        ]
    }
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any

try:
    import cv2
    import numpy as np
except ImportError:
    print("ERROR: OpenCV (cv2) is required. Install it with:")
    print("  pip install opencv-python opencv-contrib-python")
    sys.exit(1)


# ArUco dictionary used by the scanner (must match markerDetection.ts)
ARUCO_DICT = cv2.aruco.DICT_4X4_50


def generate_marker(
    marker_id: int,
    marker_size: int = 200,
    border_bits: int = 1,
    margin: int = 20
) -> np.ndarray:
    """
    Generate a single ArUco marker image.
    
    Args:
        marker_id: The ArUco marker ID (0-49 for DICT_4X4_50)
        marker_size: Size of the marker in pixels (excluding border)
        border_bits: Number of border bits around the marker
        margin: Additional white margin around the marker for printing
    
    Returns:
        NumPy array representing the marker image (grayscale, 0-255)
    """
    # Get the ArUco dictionary
    aruco_dict = cv2.aruco.getPredefinedDictionary(ARUCO_DICT)
    
    # Validate marker ID
    if marker_id < 0 or marker_id >= 50:
        raise ValueError(f"Marker ID {marker_id} is out of range for DICT_4X4_50 (0-49)")
    
    # Generate the marker
    marker_img = np.zeros((marker_size, marker_size), dtype=np.uint8)
    cv2.aruco.generateImageMarker(aruco_dict, marker_id, marker_size, marker_img, border_bits)
    
    # Add white margin for printing
    if margin > 0:
        marker_with_margin = np.ones(
            (marker_size + 2 * margin, marker_size + 2 * margin),
            dtype=np.uint8
        ) * 255
        marker_with_margin[margin:margin + marker_size, margin:margin + marker_size] = marker_img
        marker_img = marker_with_margin
    
    return marker_img


def generate_marker_set(
    marker_ids: List[int],
    output_dir: Path,
    marker_size: int = 200,
    border_bits: int = 1,
    margin: int = 20,
    name: str = "markers"
) -> List[str]:
    """
    Generate a set of ArUco markers and save them to files.
    
    Args:
        marker_ids: List of marker IDs to generate
        output_dir: Directory to save marker images
        marker_size: Size of each marker in pixels
        border_bits: Number of border bits around each marker
        margin: Additional white margin around each marker
        name: Name prefix for the marker set
    
    Returns:
        List of generated file paths
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_files = []
    
    print(f"\n📦 Generating {len(marker_ids)} markers for '{name}' set...")
    print(f"   IDs: {marker_ids}")
    print(f"   Size: {marker_size}x{marker_size}px (with {margin}px margin)")
    print(f"   Output: {output_dir}")
    
    for marker_id in marker_ids:
        try:
            marker_img = generate_marker(marker_id, marker_size, border_bits, margin)
            
            # Save as PNG for high quality
            filename = f"aruco_{name}_id{marker_id:02d}.png"
            filepath = output_dir / filename
            
            cv2.imwrite(str(filepath), marker_img)
            generated_files.append(str(filepath))
            
            print(f"   ✅ Generated: {filename}")
            
        except Exception as e:
            print(f"   ❌ Error generating marker {marker_id}: {e}")
    
    return generated_files


def load_config(config_path: Path) -> Dict[str, Any]:
    """Load marker generation configuration from JSON file."""
    with open(config_path, 'r') as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(
        description="Generate ArUco markers for exam sheets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--ids",
        type=str,
        help="Comma-separated list of marker IDs (e.g., '1,2,3,4,5,6')"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=200,
        help="Marker size in pixels (default: 200)"
    )
    parser.add_argument(
        "--margin",
        type=int,
        default=20,
        help="White margin around marker in pixels (default: 20)"
    )
    parser.add_argument(
        "--border-bits",
        type=int,
        default=1,
        help="Number of border bits around marker (default: 1)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="markers",
        help="Output directory (default: 'markers')"
    )
    parser.add_argument(
        "--name",
        type=str,
        default="marker",
        help="Name prefix for generated files (default: 'marker')"
    )
    parser.add_argument(
        "--config",
        type=str,
        help="Path to JSON configuration file (overrides other arguments)"
    )
    
    args = parser.parse_args()
    
    # If config file is provided, use it
    if args.config:
        config_path = Path(args.config)
        if not config_path.exists():
            print(f"ERROR: Config file not found: {config_path}")
            sys.exit(1)
        
        config = load_config(config_path)
        output_dir = Path(config.get("outputDir", "markers"))
        marker_size = config.get("markerSize", 200)
        border_bits = config.get("borderBits", 1)
        margin = config.get("margin", 20)
        
        # Generate markers for each set in config
        all_files = []
        for marker_set in config.get("markerSets", []):
            marker_ids = marker_set["ids"]
            name = marker_set.get("name", "marker")
            files = generate_marker_set(
                marker_ids,
                output_dir,
                marker_size,
                border_bits,
                margin,
                name
            )
            all_files.extend(files)
        
        print(f"\n✅ Generated {len(all_files)} marker files in {output_dir}")
        return
    
    # Otherwise, use command-line arguments
    if not args.ids:
        print("ERROR: Either --ids or --config must be provided")
        parser.print_help()
        sys.exit(1)
    
    try:
        marker_ids = [int(id.strip()) for id in args.ids.split(",")]
    except ValueError:
        print(f"ERROR: Invalid marker IDs format: {args.ids}")
        print("Expected format: --ids '1,2,3,4,5,6'")
        sys.exit(1)
    
    output_dir = Path(args.output)
    files = generate_marker_set(
        marker_ids,
        output_dir,
        args.size,
        args.border_bits,
        args.margin,
        args.name
    )
    
    print(f"\n✅ Generated {len(files)} marker files in {output_dir}")


if __name__ == "__main__":
    main()
