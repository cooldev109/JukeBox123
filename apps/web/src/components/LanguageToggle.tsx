import React from 'react';
import { useI18n } from '../lib/i18n';

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const { language, setLanguage } = useI18n();

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-jb-text-primary transition-all ${className}`}
      title={language === 'en' ? 'Mudar para Português' : 'Switch to English'}
    >
      <span className="text-sm">{language === 'en' ? '\uD83C\uDDFA\uD83C\uDDF8' : '\uD83C\uDDE7\uD83C\uDDF7'}</span>
      <span>{language === 'en' ? 'EN' : 'PT'}</span>
    </button>
  );
};
