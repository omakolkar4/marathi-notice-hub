import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Notice } from '../../types/notice';
import {
  Send,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  MessageSquare,
  Eye,
  X,
  Calendar,
  Trash2,
} from 'lucide-react';

export const MySubmissions: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await api.notices.getNotices();
      const myNotices = all.filter((n) => n.creator_id === user?.id);
      setSubmissions(myNotices);
    } catch (err: any) {
      setError(err.message || 'Failed to load your submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [user]);

  const handleSubmitDraft = async (noticeId: number) => {
    try {
      setActionLoading(true);
      await api.notices.submitNotice(noticeId);
      setSuccessMsg('Notice submitted for administrative review.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (selectedNotice && selectedNotice.id === noticeId) {
        setSelectedNotice(null);
      }
      fetchSubmissions();
    } catch (err: any) {
      setError(err.message || 'Failed to submit notice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelNotice = async (noticeId: number) => {
    if (!window.confirm('Are you sure you want to cancel this draft notice?')) return;
    try {
      setActionLoading(true);
      await api.notices.cancelNotice(noticeId);
      setSuccessMsg('Notice cancelled successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (selectedNotice && selectedNotice.id === noticeId) {
        setSelectedNotice(null);
      }
      fetchSubmissions();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel notice');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.original_text.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || s.approval_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Send className="w-6 h-6 text-brand-600" />
          {t('nav.mySubmissions')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track the review and distribution lifecycle of notices you have drafted or submitted.
        </p>

        {/* Filter controls */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('notices.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          <div className="w-full sm:w-56">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            >
              <option value="all">All Approval Statuses</option>
              <option value="draft">{t('status.draft')}</option>
              <option value="submitted">{t('status.submitted')}</option>
              <option value="approved">{t('status.approved')}</option>
              <option value="returned">{t('status.returned')}</option>
              <option value="rejected">{t('status.rejected')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Submissions List */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          {t('common.loading')}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No notices found matching your criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((sub) => {
            let badgeClass = 'bg-slate-100 text-slate-700';
            let StatusIcon = Clock;

            if (sub.approval_status === 'approved') {
              badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
              StatusIcon = CheckCircle;
            } else if (sub.approval_status === 'submitted') {
              badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
              StatusIcon = Clock;
            } else if (sub.approval_status === 'returned') {
              badgeClass = 'bg-orange-100 text-orange-800 border border-orange-200';
              StatusIcon = RotateCcw;
            } else if (sub.approval_status === 'rejected') {
              badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
              StatusIcon = XCircle;
            }

            return (
              <div
                key={sub.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {t(`status.${sub.approval_status}`)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {sub.predicted_category || 'General'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Created on {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{sub.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{sub.original_text}</p>

                  {/* Show reviewer remarks if returned/rejected */}
                  {sub.approvals && sub.approvals.length > 0 && sub.approvals[sub.approvals.length - 1].comment && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">Admin Remark:</span>{' '}
                        {sub.approvals[sub.approvals.length - 1].comment}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedNotice(sub)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>

                  {(sub.approval_status === 'draft' || sub.approval_status === 'returned') && (
                    <button
                      onClick={() => handleSubmitDraft(sub.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t('notices.submitForApproval')}
                    </button>
                  )}

                  {sub.approval_status === 'draft' && (
                    <button
                      onClick={() => handleCancelNotice(sub.id)}
                      disabled={actionLoading}
                      title="Cancel draft"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {t(`status.${selectedNotice.approval_status}`)}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedNotice.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(selectedNotice.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {t('notices.content')}
              </h4>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                {selectedNotice.original_text}
              </div>
            </div>

            {selectedNotice.approvals && selectedNotice.approvals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Review & Approval Log
                </h4>
                <div className="space-y-1.5">
                  {selectedNotice.approvals.map((app) => (
                    <div
                      key={app.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>Decision: {t(`status.${app.decision}`)}</span>
                        <span className="text-slate-400 font-normal">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {app.comment && (
                        <p className="text-slate-600 mt-1 italic">"{app.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
              >
                {t('common.close')}
              </button>
              {(selectedNotice.approval_status === 'draft' ||
                selectedNotice.approval_status === 'returned') && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSubmitDraft(selectedNotice.id)}
                  className="px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {t('notices.submitForApproval')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
