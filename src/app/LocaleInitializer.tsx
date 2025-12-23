"use client";

import { getLocaleFromInjected } from "../app/live/localeClient";
import { NextIntlClientProvider } from 'next-intl';
import { useState, useEffect } from 'react';
import { defaultLocale } from '../../i18n/request';

// Pre-import messages to avoid dynamic import issues
import esMessages from '../../messages/es.json';
import ptBRMessages from '../../messages/pt-BR.json';

const messagesMap: Record<string, any> = {
  'es': esMessages,
  'pt-BR': ptBRMessages,
};

/**
 * Client component that provides the locale from the injected object
 * to all child components
 * 
 * The provider from layout.tsx provides default (es) messages for SSR.
 * This component overrides with the locale from injected object after hydration.
 * 
 * We use useState/useEffect to avoid hydration mismatch - server always renders
 * with default locale, then client updates after mount.
 */
export function LocaleInitializer({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<string>(defaultLocale);
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    // After hydration, read locale from injected object
    setIsHydrated(true);
    const injectedLocale = getLocaleFromInjected();
    setLocale(injectedLocale);
  }, []);
  
  const messages = messagesMap[locale] || messagesMap[defaultLocale];
  
  // During SSR and initial render, use parent provider (messages from layout.tsx)
  // After hydration, override with locale-specific messages if different
  if (!isHydrated || locale === defaultLocale) {
    return <>{children}</>;
  }

  // Override with locale-specific messages after hydration
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

