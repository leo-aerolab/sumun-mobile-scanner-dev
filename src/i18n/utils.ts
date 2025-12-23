import { locales, type Locale } from '../../i18n/request';

/**
 * Gets the locale from the injected object (from React Native WebView)
 * The app can inject a JSON object with a 'locale' property
 * This is the ONLY source for locale - no query parameters, no other fallbacks
 */
export function getLocaleFromInjectedObject(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.ReactNativeWebView) {
    try {
      const injectedObject = window.ReactNativeWebView.injectedObjectJson();
      if (!injectedObject) {
        return null;
      }

      const parsed = JSON.parse(injectedObject);
      if (parsed.locale && locales.includes(parsed.locale as Locale)) {
        return parsed.locale as Locale;
      }
    } catch (error) {
      console.error("📱 Error parsing injected object for locale:", error);
      return null;
    }
  }
  return null;
}

