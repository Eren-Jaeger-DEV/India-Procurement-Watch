import React, { createContext, useContext, useState, useEffect } from 'react';

const AccessibilityContext = createContext();

export const useAccessibility = () => {
  return useContext(AccessibilityContext);
};

export const AccessibilityProvider = ({ children }) => {
  // Retrieve settings from localStorage or defaults
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('a11y_fontSize') || 'normal');
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('a11y_highContrast') === 'true');
  const [dyslexiaFont, setDyslexiaFont] = useState(() => localStorage.getItem('a11y_dyslexiaFont') === 'true');

  useEffect(() => {
    localStorage.setItem('a11y_fontSize', fontSize);
    localStorage.setItem('a11y_highContrast', highContrast);
    localStorage.setItem('a11y_dyslexiaFont', dyslexiaFont);

    // Apply CSS Variables and Classes to document body
    document.body.setAttribute('data-font-size', fontSize);
    
    if (highContrast) {
      document.body.classList.add('a11y-high-contrast');
    } else {
      document.body.classList.remove('a11y-high-contrast');
    }

    if (dyslexiaFont) {
      document.body.classList.add('a11y-dyslexia');
    } else {
      document.body.classList.remove('a11y-dyslexia');
    }
  }, [fontSize, highContrast, dyslexiaFont]);

  const value = {
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    dyslexiaFont,
    setDyslexiaFont
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};
