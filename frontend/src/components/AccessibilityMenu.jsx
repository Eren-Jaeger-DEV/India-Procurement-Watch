import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { Settings, X, Type, Eye, Globe } from 'lucide-react';
import './AccessibilityMenu.css';

export default function AccessibilityMenu({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const { 
    fontSize, setFontSize, 
    highContrast, setHighContrast,
    dyslexiaFont, setDyslexiaFont 
  } = useAccessibility();

  if (!isOpen) return null;

  return (
    <div className="a11y-overlay" onClick={onClose}>
      <div className="a11y-modal" onClick={e => e.stopPropagation()}>
        <div className="a11y-header">
          <div className="a11y-title">
            <Settings size={20} />
            <h2>{t('accessibility_settings')}</h2>
          </div>
          <button className="a11y-close-btn" onClick={onClose} aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>

        <div className="a11y-content">
          
          {/* Language Selection */}
          <div className="a11y-section">
            <h3><Globe size={16} /> {t('language')}</h3>
            <div className="a11y-btn-group">
              <button 
                className={`a11y-btn ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => i18n.changeLanguage('en')}
              >
                English
              </button>
              <button 
                className={`a11y-btn ${i18n.language === 'hi' ? 'active' : ''}`}
                onClick={() => i18n.changeLanguage('hi')}
              >
                हिन्दी
              </button>
            </div>
          </div>

          {/* Text Size */}
          <div className="a11y-section">
            <h3><Type size={16} /> {t('text_size')}</h3>
            <div className="a11y-btn-group">
              <button 
                className={`a11y-btn ${fontSize === 'small' ? 'active' : ''}`}
                onClick={() => setFontSize('small')}
                style={{ fontSize: '14px' }}
              >
                A-
              </button>
              <button 
                className={`a11y-btn ${fontSize === 'normal' ? 'active' : ''}`}
                onClick={() => setFontSize('normal')}
                style={{ fontSize: '16px' }}
              >
                A
              </button>
              <button 
                className={`a11y-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                style={{ fontSize: '18px' }}
              >
                A+
              </button>
              <button 
                className={`a11y-btn ${fontSize === 'extra_large' ? 'active' : ''}`}
                onClick={() => setFontSize('extra_large')}
                style={{ fontSize: '20px' }}
              >
                A++
              </button>
            </div>
          </div>

          {/* Contrast & Font Toggles */}
          <div className="a11y-section">
            <h3><Eye size={16} /> Visuals</h3>
            
            <label className="a11y-toggle">
              <input 
                type="checkbox" 
                checked={highContrast} 
                onChange={(e) => setHighContrast(e.target.checked)} 
              />
              <span className="slider"></span>
              <span className="label-text">{t('high_contrast')}</span>
            </label>

            <label className="a11y-toggle">
              <input 
                type="checkbox" 
                checked={dyslexiaFont} 
                onChange={(e) => setDyslexiaFont(e.target.checked)} 
              />
              <span className="slider"></span>
              <span className="label-text">{t('dyslexia_font')}</span>
            </label>

          </div>

        </div>
      </div>
    </div>
  );
}
