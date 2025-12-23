import { getRequestConfig } from 'next-intl/server';

// Supported locales
export const locales = ['es', 'pt-BR'] as const;
export type Locale = (typeof locales)[number];

// Default locale
export const defaultLocale: Locale = 'es';

export default getRequestConfig(async () => {
  // Server always uses default locale
  // Client will read from injected object and update dynamically
  // No cookies, no query parameters, no headers
  
  return {
    locale: defaultLocale,
    messages: (await import(`../messages/${defaultLocale}.json`)).default
  };
});

