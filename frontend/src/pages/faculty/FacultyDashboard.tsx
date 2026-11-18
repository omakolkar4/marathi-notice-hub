import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Notice } from '../../types/notice';
import {
  Inbox,
  Send,
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Clock,
  BookOpen,
  Calendar,
  Building2,
  CheckCheck,
  QrCode,
} from 'lucide-react';

export const FacultyDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [receivedNotices, setReceivedNotices] = useState<Notice[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch notices received (distributed) and notices created by me
      const [allNotices] = await Promise.all([
        api.notices.getNotices(),
      ]);

      // Submissions by this user
      const submittedByMe = allNotices.filter((n) => n.creator_id === user?.id);
      setMySubmissions(submittedByMe);

      // Distributed notices relevant to faculty
      const distributed = allNotices.filter((n) => n.distribution_status === 'distributed');
      setReceivedNotices(distributed);
    } catch (err) {
      console.error('Failed to load faculty dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAcknowledge = async (noticeId: number) => {
    try {
      setActionLoading(noticeId);
      await api.notices.acknowledgeNotice(noticeId);
      setSuccessMsg(t('notices.acknowledged') + '!');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge notice');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-medium text-brand-100 mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{user?.department?.name || 'Faculty Member'}</span>
            {user?.subject && <span>• {user.subject}</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t('dashboard.welcomeFaculty')}, {user?.name}!
          </h1>
          <p className="text-brand-100 text-sm mt-1 max-w-2xl">
            {t('appName')} — Review academic notices, departmental circulars, and submit notices for principal approval.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/faculty/exam-duties"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg text-sm font-bold transition-colors shadow-xs"
            >
              <QrCode className="w-4 h-4" />
              {t('nav.examDuties')}
            </Link>
            <Link
              to="/faculty/notices"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-800 rounded-lg text-sm font-semibold hover:bg-brand-50 transition-colors shadow-xs"
            >
              <Inbox className="w-4 h-4" />
              {t('nav.receivedNotices')}
            </Link>
            <Link
              to="/faculty/create-notice"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600/80 hover:bg-brand-600 text-white border border-white/20 rounded-lg text-sm font-semibold transition-colors"
            >
              <FilePlus2 className="w-4 h-4" />
              {t('nav.createNotice')}
            </Link>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('nav.receivedNotices')}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{receivedNotices.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('notices.unread')}
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-0.5">
              {receivedNotices.filter((n) => n.is_read === false).length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('dashboard.pendingAcks')}
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-0.5">
              {receivedNotices.filter((n) => !n.is_acknowledged).length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('nav.mySubmissions')}
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-0.5">{mySubmissions.length}</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Received Notices & Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Circulars */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-brand-600" />
              {t('dashboard.recentNotices')}
            </h2>
            <Link
              to="/faculty/notices"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              View All ({receivedNotices.length})
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
          ) : receivedNotices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('dashboard.noNotices')}</div>
          ) : (
            <div className="space-y-3">
              {receivedNotices.slice(0, 5).map((notice) => (
                <div
                  key={notice.id}
                  className={`p-4 rounded-xl border transition-colors bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    notice.is_read === false ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 hover:border-brand-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-brand-50 text-brand-700">
                        {notice.predicted_category || 'General'}
                      </span>
                      {notice.is_read === false ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                          NEW / UNREAD
                        </span>
                      ) : notice.is_acknowledged ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ✓ {t('notices.acknowledged')}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                          READ (PENDING ACK)
                        </span>
                      )}
                      {notice.priority === 'urgent' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                          {t('priorities.urgent')}
                        </span>
                      )}
                      {notice.source_organization && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          🏛️ {notice.source_organization}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(notice.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">{notice.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{notice.original_text}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {notice.is_acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-3 py-1.5">
                        <CheckCheck className="w-3.5 h-3.5" />
                        {t('notices.acknowledged')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(notice.id)}
                        disabled={actionLoading === notice.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        {t('notices.acknowledge')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: My Submissions */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              {t('nav.mySubmissions')}
            </h2>
            <Link
              to="/faculty/my-submissions"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800"
            >
              View All ({mySubmissions.length})
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
          ) : mySubmissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              You haven't submitted any draft notices yet.
            </div>
          ) : (
            <div className="space-y-3">
              {mySubmissions.slice(0, 5).map((sub) => {
                let statusBadge = 'bg-slate-100 text-slate-700';
                if (sub.approval_status === 'approved') statusBadge = 'bg-emerald-100 text-emerald-800';
                if (sub.approval_status === 'submitted') statusBadge = 'bg-amber-100 text-amber-800';
                if (sub.approval_status === 'rejected') statusBadge = 'bg-rose-100 text-rose-800';
                if (sub.approval_status === 'returned') statusBadge = 'bg-orange-100 text-orange-800';

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge}`}>
                        {t(`status.${sub.approval_status}`)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm mt-2 line-clamp-1">{sub.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{sub.original_text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
