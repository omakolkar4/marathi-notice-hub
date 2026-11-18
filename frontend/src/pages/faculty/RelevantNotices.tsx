import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Notice, NoticeCategory } from '../../types/notice';
import {
  Inbox,
  Search,
  Filter,
  Eye,
  CheckCheck,
  Calendar,
  Clock,
  Paperclip,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';

export const RelevantNotices: React.FC = () => {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Selected Notice Modal
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.notices.getNotices();
      // Distributed notices
      const distributed = data.filter((n) => n.distribution_status === 'distributed');
      setNotices(distributed);
    } catch (err: any) {
      setError(err.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleOpenNotice = async (notice: Notice) => {
    setSelectedNotice(notice);
    // Automatically record 'read' on opening
    try {
      await api.notices.markAsRead(notice.id);
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, is_read: true } : n))
      );
    } catch {
      // Non-fatal if already marked read
    }
  };

  const handleAcknowledge = async (noticeId: number) => {
    try {
      setActionLoading(true);
      await api.notices.acknowledgeNotice(noticeId);
      setSuccessMsg(t('notices.acknowledged') + '!');
      setTimeout(() => setSuccessMsg(null), 3000);
      if (selectedNotice && selectedNotice.id === noticeId) {
        // Refresh selected notice details
        const updated = await api.notices.getNotice(noticeId);
        setSelectedNotice(updated);
      }
      fetchNotices();
    } catch (err: any) {
      setError(err.message || 'Failed to acknowledge notice');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredNotices = notices.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.original_text.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'all' || n.predicted_category === categoryFilter;

    const matchesPriority =
      priorityFilter === 'all' || n.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesPriority;
  });

  const categories: NoticeCategory[] = [
    'Examination',
    'Meeting',
    'Holiday',
    'Academic',
    'Event',
    'Administrative',
    'Emergency',
    'General',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Inbox className="w-6 h-6 text-brand-600" />
          {t('nav.receivedNotices')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          All school-wide, departmental, and administrative notices distributed to you.
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

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            >
              <option value="all">{t('notices.filterCategory')}: All</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`categories.${cat}`)}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="py-2 px-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            >
              <option value="all">{t('notices.priority')}: All</option>
              <option value="normal">{t('priorities.normal')}</option>
              <option value="urgent">{t('priorities.urgent')}</option>
              <option value="emergency">{t('priorities.emergency')}</option>
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

      {/* Notice Cards List */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          {t('common.loading')}
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          {t('dashboard.noNotices')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`bg-white p-5 rounded-xl border shadow-xs hover:border-brand-300 transition-all flex flex-col justify-between ${
                notice.is_read === false ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
                      {notice.predicted_category || 'General'}
                    </span>
                    {notice.is_read === false ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                        NEW / UNREAD
                      </span>
                    ) : notice.is_acknowledged ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        ✓ {t('notices.acknowledged')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        READ (PENDING ACK)
                      </span>
                    )}
                  </div>
                  {notice.priority === 'urgent' && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800">
                      {t('priorities.urgent')}
                    </span>
                  )}
                </div>

                {notice.source_organization && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    <span>🏛️</span>
                    <span>{notice.source_organization}</span>
                    {notice.source_date && <span>({notice.source_date})</span>}
                  </div>
                )}

                <h3 className="font-bold text-slate-900 text-base mt-2 line-clamp-2">
                  {notice.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 line-clamp-3 whitespace-pre-line">
                  {notice.original_text}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {new Date(notice.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenNotice(notice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Read Notice
                  </button>
                  {notice.is_acknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold py-1.5 px-2">
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t('notices.acknowledged')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(notice.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t('notices.acknowledge')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Notice View Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
                    {selectedNotice.predicted_category || 'General'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Circular #{selectedNotice.id}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedNotice.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedNotice.created_at).toLocaleString()}
                  </span>
                  <span>Issued By: {selectedNotice.creator?.name || 'School Office'}</span>
                  {selectedNotice.source_organization && (
                    <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      🏛️ {selectedNotice.source_organization} {selectedNotice.source_date ? `(${selectedNotice.source_date})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Original Notice Content (Exact Devanagari / Latin preservation) */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                {t('notices.content')}
              </h4>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {selectedNotice.original_text}
              </div>
            </div>

            {/* Attachment link if exists */}
            {selectedNotice.attachment_url && (
              <div className="flex items-center gap-2 text-xs text-brand-600 bg-brand-50 p-3 rounded-lg border border-brand-200">
                <Paperclip className="w-4 h-4" />
                <span className="font-semibold">Attachment:</span>
                <a
                  href={selectedNotice.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-brand-800 break-all"
                >
                  {selectedNotice.attachment_url}
                </a>
              </div>
            )}

            {/* NLP Extracted Entities (Dates, Deadlines, Times) */}
            {selectedNotice.nlp_analysis?.extracted_entities && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Important Dates & Timings Detected
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedNotice.nlp_analysis.extracted_entities.dates?.map((d, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800"
                    >
                      <Calendar className="w-3.5 h-3.5 text-brand-600" />
                      {d.raw_text} ({d.formatted})
                    </span>
                  ))}
                  {selectedNotice.nlp_analysis.extracted_entities.times?.map((tItem, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {tItem.raw_text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
              >
                {t('common.close')}
              </button>
              {selectedNotice.is_acknowledged ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCheck className="w-4 h-4" />
                  {t('notices.acknowledged')}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAcknowledge(selectedNotice.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-xs disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  {t('notices.acknowledge')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
