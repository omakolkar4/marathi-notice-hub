import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Notice } from '../../types/notice';
import { User } from '../../types/auth';
import {
  FileText,
  FileCheck2,
  Users,
  Send,
  PlusCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  QrCode,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [noticesData, facultyData] = await Promise.all([
          api.notices.getNotices(),
          api.users.getUsers({ role: 'Faculty' }),
        ]);
        setNotices(noticesData);
        setFaculty(facultyData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const pendingApprovals = notices.filter((n) => n.approval_status === 'submitted');
  const distributedNotices = notices.filter((n) => n.distribution_status === 'distributed');
  const activeFaculty = faculty.filter((f) => f.is_active);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t('dashboard.welcomeAdmin')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('appName')} — {t('projectTitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/examinations"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>{t('nav.examinationManagement')}</span>
          </Link>
          <Link
            to="/admin/create-notice"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all self-start sm:self-auto cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('nav.createNotice')}</span>
          </Link>
        </div>
      </div>

      {/* Pending Approvals Urgent Banner if any */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                {pendingApprovals.length} {t('dashboard.pendingApprovals')}
              </h3>
              <p className="text-xs text-amber-700">
                Faculty members have submitted notices awaiting your official review and distribution.
              </p>
            </div>
          </div>
          <Link
            to="/admin/approvals"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all self-start sm:self-auto cursor-pointer"
          >
            <span>{t('nav.pendingApprovals')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Notices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('dashboard.totalNotices')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {isLoading ? '...' : notices.length}
            </span>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('dashboard.pendingApprovals')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {isLoading ? '...' : pendingApprovals.length}
            </span>
          </div>
        </div>

        {/* Active Faculty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('dashboard.activeFaculty')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {isLoading ? '...' : activeFaculty.length}
            </span>
          </div>
        </div>

        {/* Distributed Notices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              {t('dashboard.distributedNotices')}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {isLoading ? '...' : distributedNotices.length}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Notices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {t('dashboard.recentNotices')}
          </h2>
          <Link
            to="/admin/reports"
            className="text-xs font-semibold text-brand-600 hover:text-brand-800"
          >
            {t('nav.deliveryReports')} →
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('common.loading')}
          </div>
        ) : notices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('dashboard.noNotices')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">{t('notices.title')}</th>
                  <th className="px-6 py-3">{t('notices.category')}</th>
                  <th className="px-6 py-3">{t('notices.priority')}</th>
                  <th className="px-6 py-3">{t('notices.status')}</th>
                  <th className="px-6 py-3">{t('notices.createdOn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notices.slice(0, 6).map((notice) => (
                  <tr key={notice.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {notice.title}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="bg-brand-50 text-brand-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-brand-200">
                        {t(`categories.${notice.predicted_category}`, notice.predicted_category || 'General')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          notice.priority === 'emergency'
                            ? 'bg-rose-100 text-rose-800'
                            : notice.priority === 'urgent'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t(`priorities.${notice.priority}`)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          notice.approval_status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : notice.approval_status === 'submitted'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t(`status.${notice.approval_status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(notice.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
