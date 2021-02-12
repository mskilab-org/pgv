import i18n from "i18next";
import { initReactI18next } from 'react-i18next';
import common_en from "./translations/en/common.json";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  lng: "en",
  resources: {
    en: {
      common: common_en, // 'common' is our custom namespace
    },
  },
  interpolation: {
    escapeValue: false,
  },

  wait: true,
});

export default i18n;