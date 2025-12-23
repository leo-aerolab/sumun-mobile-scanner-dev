import { CameraInstructions } from "./live/CameraInstructions";
import { LocaleInitializer } from "./LocaleInitializer";

// Main entry point for the Sumun Exam PWA
// Safe area handling: The layout.tsx provides global safe area support
// Individual components handle their own positioning within safe boundaries
export default function Home() {
  return (
    <LocaleInitializer>
      <CameraInstructions />
    </LocaleInitializer>
  );
}
