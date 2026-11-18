import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SchoolSetting, ProfileUpdatePayload } from '../../types/settings';
import {
  User,
  Building,
  Globe,
  Sun,
  Moon,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  School,
  Lock,
  ArrowRightLeft,
  Crown
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProfileSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'school'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState<ProfileUpdatePayload>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    designation: user?.designation || '',
    preferred_language: (user?.preferred_language as 'mr' | 'en' | 'hi') || 'mr',
    theme_preference: (user?.theme_preference as 'light' | 'dark') || 'light',
  });

  // School Settings State (Admin view only)
  const [schoolSetting, setSchoolSetting] = useState<SchoolSetting | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    school_name: '',
    school_code: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    principal_name: '',
    academic_year: '2026-2027',
  });

  const canManageSchool =
    user?.role === 'Admin' &&
    (user.is_principal ||
      (user.permissions &&
        (user.permissions.includes('full_admin') ||
          user.permissions.includes('settings_management'))));

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        designation: user.designation || '',
        preferred_language: (user.preferred_language as 'mr' | 'en' | 'hi') || 'mr',
        theme_preference: (user.theme_preference as 'light' | 'dark') || 'light',
      });
    }

    const fetchSchool = async () => {
      try {
        const data = await api.settings.getSchoolSettings();
        setSchoolSetting(data);
        setSchoolForm({
          school_name: data.school_name || '',
          school_code: data.school_code || '',
          address: data.address || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
          principal_name: data.principal_name || '',
          academic_year: data.academic_year || '2026-2027',
        });
      } catch (err: any) {
        console.error('Failed to load school settings', err);
      }
    };

    fetchSchool();
  }, [user]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await api.settings.updateProfile(profileForm);
      await refreshUser();
      showNotification(t('common.success'));
    } catch (err: any) {
      setError(err.message || 'Failed to update profile settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (lang: 'mr' | 'en' | 'hi') => {
    i18n.changeLanguage(lang);
    setProfileForm((prev: ProfileUpdatePayload) => ({ ...prev, preferred_language: lang }));
    try {
      await api.settings.updateProfile({ preferred_language: lang });
      await refreshUser();
      showNotification(t('common.success'));
    } catch (err: any) {
      console.error('Failed to save language preference', err);
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    setProfileForm((prev: ProfileUpdatePayload) => ({ ...prev, theme_preference: theme }));
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      await api.settings.updateProfile({ theme_preference: theme });
      await refreshUser();
      showNotification(t('common.success'));
    } catch (err: any) {
      console.error('Failed to save theme preference', err);
    }
  };

  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSchool) return;
    setIsLoading(true);
    setError(null);
    try {
      const updated = await api.settings.updateSchoolSettings(schoolForm);
      setSchoolSetting(updated);
      showNotification(t('common.success'));
    } catch (err: any) {
      setError(err.message || 'Failed to update school settings.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 border border-brand-100">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t('settings.title')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('settings.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {user?.is_principal && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <Crown className="w-4 h-4 text-amber-700" />
            <span>{t('adminManagement.designatedPrincipal')}</span>
          </span>
        )}
      </div>

      {/* Notification Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{t('settings.personalProfile')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'appearance'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t('settings.languageTheme')}</span>
        </button>

        {user?.role === 'Admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('school')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'school'
                ? 'border-brand-600 text-brand-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <School className="w-4 h-4" />
            <span>{t('settings.schoolSettings')}</span>
          </button>
        )}
      </div>

      {/* Tab 1: Profile Settings */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-3xl">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">{t('settings.accountContact')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('settings.subtitle')}
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.fullName')} *
              </label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.username')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={user?.username || ''}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-mono outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
                <span className="text-2xs text-slate-400 mt-1 block">
                  {t('settings.usernameNote')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.email')} *
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.phone')}
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.designation')}
                </label>
                <input
                  type="text"
                  value={profileForm.designation}
                  onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-700">{t('settings.rolePrivileges')}:</span>
                <span className="ml-2 font-bold text-slate-900">{user?.role}</span>
              </div>
              <span className="text-slate-500 font-mono text-2xs">
                {user?.department?.name || 'School-wide'}
              </span>
            </div>

            {user?.role === 'Admin' && (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-2">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-700" />
                  {t('adminManagement.transferPrincipal')}
                </p>
                <p className="text-amber-800">
                  {t('adminManagement.subtitle')}
                </p>
                <Link
                  to="/admin/admins"
                  className="inline-flex items-center gap-1.5 text-amber-900 font-bold hover:underline"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{t('adminManagement.title')}</span>
                </Link>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? t('settings.saving') : t('settings.saveChanges')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Language & Theme */}
      {activeTab === 'appearance' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-3xl space-y-8">
          {/* Language Selection */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-brand-600" />
                <span>{t('settings.interfaceLanguage')}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('settings.languageDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { code: 'mr', title: 'मराठी', tag: 'Primary', desc: 'राज्य मानकांनुसार संपूर्ण मराठी' },
                { code: 'en', title: 'English', tag: 'International', desc: 'Standard administrative English' },
                { code: 'hi', title: 'हिन्दी', tag: 'National', desc: 'राष्ट्रभाषा हिंदी में' },
              ].map((langItem) => {
                const isActive = i18n.language?.startsWith(langItem.code);
                return (
                  <button
                    key={langItem.code}
                    type="button"
                    onClick={() => handleLanguageChange(langItem.code as any)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-brand-500 ring-2 ring-brand-100 bg-brand-50/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm">{langItem.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 text-slate-600">
                        {langItem.tag}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500">{langItem.desc}</p>
                    {isActive && (
                      <div className="mt-3 text-xs font-bold text-brand-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('common.active')}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Selection */}
          <div className="pt-6 border-t border-slate-100">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>{t('settings.themeAppearance')}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('settings.themeDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  profileForm.theme_preference === 'light'
                    ? 'border-amber-400 ring-2 ring-amber-100 bg-amber-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{t('settings.lightTheme')}</div>
                    <div className="text-2xs text-slate-500">{t('settings.lightThemeDesc')}</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  profileForm.theme_preference === 'dark'
                    ? 'border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{t('settings.darkTheme')}</div>
                    <div className="text-2xs text-slate-500">{t('settings.darkThemeDesc')}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: School Settings */}
      {activeTab === 'school' && user?.role === 'Admin' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-3xl">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <School className="w-5 h-5 text-brand-600" />
                <span>{t('settings.schoolSettings')}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('settings.adminOnlySettings')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSchoolSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.schoolName')} *
              </label>
              <input
                type="text"
                required
                disabled={!canManageSchool}
                value={schoolForm.school_name}
                onChange={(e) => setSchoolForm({ ...schoolForm, school_name: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.schoolCode')}
                </label>
                <input
                  type="text"
                  disabled={!canManageSchool}
                  value={schoolForm.school_code}
                  onChange={(e) => setSchoolForm({ ...schoolForm, school_code: e.target.value })}
                  placeholder="MV-PUNE-01"
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.principalName')}
                </label>
                <input
                  type="text"
                  disabled={!canManageSchool}
                  value={schoolForm.principal_name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, principal_name: e.target.value })}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.schoolAddress')}
              </label>
              <textarea
                rows={2}
                disabled={!canManageSchool}
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.email')}
                </label>
                <input
                  type="email"
                  disabled={!canManageSchool}
                  value={schoolForm.contact_email}
                  onChange={(e) => setSchoolForm({ ...schoolForm, contact_email: e.target.value })}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('settings.academicYear')}
                </label>
                <input
                  type="text"
                  disabled={!canManageSchool}
                  value={schoolForm.academic_year}
                  onChange={(e) => setSchoolForm({ ...schoolForm, academic_year: e.target.value })}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {canManageSchool && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isLoading ? t('settings.saving') : t('settings.saveChanges')}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
