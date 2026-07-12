'use client';

import { type ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n, { DEFAULT_LANGUAGE } from './config';

function getActiveLanguage() {
  return i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANGUAGE;
}

export default function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const syncDocumentLanguage = (lng = getActiveLanguage()) => {
      document.documentElement.lang = lng;
    };

    syncDocumentLanguage();
    i18n.on('languageChanged', syncDocumentLanguage);

    return () => {
      i18n.off('languageChanged', syncDocumentLanguage);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
