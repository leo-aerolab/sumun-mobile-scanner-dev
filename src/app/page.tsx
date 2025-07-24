import { WelcomeScreen } from "./components/WelcomeScreen";

// Main entry point for the Sumun Exam PWA
// Safe area handling: The layout.tsx provides global safe area support
// Individual components handle their own positioning within safe boundaries
export default function Home() {
  return <WelcomeScreen />;
}
