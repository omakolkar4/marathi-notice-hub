import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { LanguageSelector } from './LanguageSelector';
import { BookOpen, LogOut, ShieldCheck, UserCheck } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const homePath = user?.role === 'Admin' ? '/admin' : '/faculty';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Clickable Brand Header */}
        <Link
          to={homePath}
          className="flex items-center space-x-3 group transition-transform hover:opacity-95"
          title={t('appName')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight group-hover:text-brand-700 transition-colors">
              {t('appName')}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              {t('auth.loginSubtitle')}
            </p>
          </div>
        </Link>

        {/* User Controls & Language */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* Language Selector */}
          <LanguageSelector />

          {/* User Info & Badge */}
          {user && (
            <div className="flex items-center space-x-3 border-l border-slate-200 pl-3 sm:pl-4">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-slate-900">
                  {user.name}
                </div>
                <div className="text-xs text-slate-500 flex items-center justify-end space-x-1">
                  <span>{user.designation || user.subject || user.role}</span>
                </div>
              </div>

              {/* Role Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  user.role === 'Admin'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-brand-50 text-brand-700 border border-brand-200'
                }`}
              >
                {user.role === 'Admin' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                )}
                {t(`roles.${user.role}`)}
              </span>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title={t('auth.logout')}
                aria-label={t('auth.logout')}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
