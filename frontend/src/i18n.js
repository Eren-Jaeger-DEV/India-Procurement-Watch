import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files
const resources = {
  en: {
    translation: {
      "dashboard": "Dashboard",
      "map": "Procurement Map",
      "import": "Data Import",
      "geo": "Geographical",
      "orgs": "Organizations",
      "tenders": "Tenders",
      "investigation": "Investigation",
      "search": "Search Database",
      "network": "Network Graph",
      "chat": "AI Chat",
      "redflag": "Red Flags",
      "insights": "Insights",
      "collusion": "Collusion Radar",
      "departments": "Departments",
      "sources": "Data Sources",
      
      // Accessibility Menu
      "accessibility_settings": "Accessibility Settings",
      "language": "Language",
      "text_size": "Text Size",
      "small": "Small",
      "normal": "Normal",
      "large": "Large",
      "extra_large": "Extra Large",
      "high_contrast": "High Contrast Mode",
      "dyslexia_font": "Dyslexia Friendly Font",
      "close": "Close"
    }
  },
  hi: {
    translation: {
      "dashboard": "डैशबोर्ड",
      "map": "प्रोक्योरमेंट मैप",
      "import": "डेटा आयात (Import)",
      "geo": "भौगोलिक (Geographical)",
      "orgs": "संगठन (Organizations)",
      "tenders": "टेंडर (Tenders)",
      "investigation": "जांच (Investigation)",
      "search": "डेटाबेस खोजें",
      "network": "नेटवर्क ग्राफ",
      "chat": "एआई चैट",
      "redflag": "रेड फ्लैग (Red Flags)",
      "insights": "अंतर्दृष्टि (Insights)",
      "collusion": "मिलीभगत रडार",
      "departments": "विभाग",
      "sources": "डेटा स्रोत",
      
      // Accessibility Menu
      "accessibility_settings": "पहुंच-योग्यता सेटिंग (Accessibility)",
      "language": "भाषा (Language)",
      "text_size": "टेक्स्ट का आकार",
      "small": "छोटा",
      "normal": "सामान्य",
      "large": "बड़ा",
      "extra_large": "बहुत बड़ा",
      "high_contrast": "उच्च कंट्रास्ट (High Contrast)",
      "dyslexia_font": "डिस्लेक्सिया फ़ॉन्ट",
      "close": "बंद करें"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
