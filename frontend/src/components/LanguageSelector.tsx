import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'pill' | 'select';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  variant = 'pill',
}) => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'mr', label: 'मराठी', short: 'MR' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'hi', label: 'हिन्दी', short: 'HI' },
  ];

  const currentLang = i18n.language?.startsWith('mr')
    ? 'mr'
    : i18n.language?.startsWith('hi')
    ? 'hi'
    : 'en';

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
  };

  if (variant === 'select') {
    return (
      <div className={`relative inline-flex items-center ${className}`}>
        <Globe className="w-4 h-4 text-slate-500 absolute left-2.5 pointer-events-none" />
        <select
          value={currentLang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="pl-8 pr-4 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer"
          aria-label="Language Selector"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 ${className}`}>
      <Globe className="w-4 h-4 text-slate-500 ml-1.5 mr-1" />
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => handleLanguageChange(lang.code)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            currentLang === lang.code
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};
