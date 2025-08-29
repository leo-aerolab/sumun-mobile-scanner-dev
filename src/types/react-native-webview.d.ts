declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
      injectedObjectJson: () => string;
    };
  }
}

export {}; 