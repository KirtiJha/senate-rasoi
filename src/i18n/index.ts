import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectDeviceLang } from '../lib/translate';
import bn from './locales/bn.json';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import or from './locales/or.json';
import pa from './locales/pa.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ur from './locales/ur.json';

/**
 * Static UI-string localisation (the app's own chrome — buttons, labels, nav).
 * Distinct from the Gemini `<T>` layer, which translates user-generated content.
 * Files are authored in `en.json`; the others are machine-translated by
 * `scripts/gen-locales.mjs` (any key not yet translated falls back to English).
 */
export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  kn: { translation: kn },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  ml: { translation: ml },
  gu: { translation: gu },
  pa: { translation: pa },
  or: { translation: or },
  ur: { translation: ur },
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectDeviceLang(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
    returnEmptyString: false, // empty/missing key → fall back to English
  });
}

export default i18n;
