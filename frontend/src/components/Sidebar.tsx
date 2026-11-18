import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FilePlus2,
  FileCheck2,
  Inbox,
  Send,
  Users,
  Building2,
  BarChart3,
  ClipboardCheck,
  QrCode,
  ShieldCheck,
  Settings,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return null;

  const adminLinks = [
    { to: '/admin', label: t('nav.home'), icon: LayoutDashboard },
    { to: '/admin/approvals', label: t('nav.pendingApprovals'), icon: FileCheck2 },
    { to: '/admin/create-notice', label: t('nav.createNotice'), icon: FilePlus2 },
    { to: '/admin/examinations', label: t('nav.examinationManagement'), icon: ClipboardCheck },
    { to: '/admin/faculty', label: t('nav.facultyManagement'), icon: Users },
    { to: '/admin/admins', label: t('nav.adminManagement'), icon: ShieldCheck },
    { to: '/admin/departments', label: t('nav.departmentManagement'), icon: Building2 },
    { to: '/admin/reports', label: t('nav.deliveryReports'), icon: BarChart3 },
    { to: '/admin/settings', label: t('nav.profileSettings'), icon: Settings },
  ];

  const facultyLinks = [
    { to: '/faculty', label: t('nav.home'), icon: LayoutDashboard },
    { to: '/faculty/notices', label: t('nav.receivedNotices'), icon: Inbox },
    { to: '/faculty/exam-duties', label: t('nav.examDuties'), icon: QrCode },
    { to: '/faculty/create-notice', label: t('nav.createNotice'), icon: FilePlus2 },
    { to: '/faculty/my-submissions', label: t('nav.mySubmissions'), icon: Send },
    { to: '/faculty/settings', label: t('nav.profileSettings'), icon: Settings },
  ];

  const links = user.role === 'Admin' ? adminLinks : facultyLinks;

  return (
    <aside className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0 md:min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {user.role === 'Admin' ? t('roles.Admin') : t('roles.Faculty')} {t('nav.dashboard')}
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin' || link.to === '/faculty'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
};
