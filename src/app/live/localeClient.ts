"use client";

import { getLocaleFromInjectedObject } from '../../i18n/utils';
import { defaultLocale, type Locale } from '../../../i18n/request';

/**
 * Client-side function to get locale from injected object only
 * Returns the locale or null if not found
 */
export function getLocaleFromInjected(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  // Only read from injected object (from React Native WebView)
  const injectedLocale = getLocaleFromInjectedObject();
  
  return injectedLocale || defaultLocale;
}

