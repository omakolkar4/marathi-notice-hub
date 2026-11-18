import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Notice } from '../../types/notice';
import {
  BarChart3,
  CheckCheck,
  Eye,
  Users,
  Search,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const DistributionReports: React.FC = () => {
  const { t } = useTranslation();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.notices.getNotices();
      // Filter distributed notices
      const distributed = data.filter((n) => n.distribution_status === 'distributed');
      setNotices(distributed);
      if (distributed.length > 0 && !selectedNotice) {
        handleSelectNotice(distributed[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load distribution data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNotice = async (noticeId: number) => {
    try {
      setDetailLoading(true);
      const fullNotice = await api.notices.getNotice(noticeId);
      setSelectedNotice(fullNotice);
    } catch (err: any) {
      setError(err.message || 'Failed to load recipient details');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const totalRecipients = notices.reduce((acc, n) => acc + (n.recipient_count || 0), 0);
  const totalRead = notices.reduce((acc, n) => acc + (n.read_count || 0), 0);
  const totalAck = notices.reduce((acc, n) => acc + (n.acknowledged_count || 0), 0);

  const overallReadRate = totalRecipients > 0 ? Math.round((totalRead / totalRecipients) * 100) : 0;
  const overallAckRate = totalRecipients > 0 ? Math.round((totalAck / totalRecipients) * 100) : 0;

  const filteredNotices = notices.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.predicted_category && n.predicted_category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-600" />
          {t('reports.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor delivery, faculty read rates, and compliance acknowledgments across circulars.
        </p>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('dashboard.distributedNotices')}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{notices.length}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('reports.totalRecipients')}
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalRecipients}</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('reports.readRate')}
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{overallReadRate}%</div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${overallReadRate}%` }}
              ></div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('reports.ackRate')}
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{overallAckRate}%</div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${overallAckRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Notice Selector */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('notices.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">{t('common.loading')}</div>
            ) : filteredNotices.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No distributed notices matching search.
              </div>
            ) : (
              filteredNotices.map((n) => {
                const isSelected = selectedNotice?.id === n.id;
                const recCount = n.recipient_count || 0;
                const readCount = n.read_count || 0;
                const ackCount = n.acknowledged_count || 0;
                const readPct = recCount > 0 ? Math.round((readCount / recCount) * 100) : 0;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleSelectNotice(n.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-50/70 border-l-4 border-l-brand-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">{n.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700 shrink-0">
                        #{n.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>{n.predicted_category || 'General'}</span>
                      <span>•</span>
                      <span>{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>{recCount} {t('reports.totalRecipients')}</span>
                      <span className="font-semibold text-brand-700">{readPct}% Read</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Breakdown for Selected Notice */}
        <div className="lg:col-span-7">
          {detailLoading ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
              {t('common.loading')}
            </div>
          ) : !selectedNotice ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
              Select a circular on the left to inspect faculty acknowledgment reports.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Selected Notice Summary */}
              <div>
                <div className="flex items-center gap-2 text-xs text-brand-600 font-semibold uppercase tracking-wider">
                  <span>Circular #{selectedNotice.id}</span>
                  <span>•</span>
                  <span>{selectedNotice.predicted_category}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedNotice.title}</h2>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedNotice.created_at).toLocaleString()}
                  </span>
                  <span>Author: {selectedNotice.creator?.name || 'Administrator'}</span>
                </p>
              </div>

              {/* Progress Summary */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div>
                  <div className="text-xs text-slate-500">{t('reports.totalRecipients')}</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {selectedNotice.recipient_count || selectedNotice.recipients?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('notices.read')}</div>
                  <div className="text-xl font-bold text-blue-600 mt-0.5">
                    {selectedNotice.read_count ||
                      selectedNotice.recipients?.filter((r) => r.is_read).length ||
                      0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t('notices.acknowledged')}</div>
                  <div className="text-xl font-bold text-emerald-600 mt-0.5">
                    {selectedNotice.acknowledged_count ||
                      selectedNotice.recipients?.filter((r) => r.is_acknowledged).length ||
                      0}
                  </div>
                </div>
              </div>

              {/* Faculty Recipients Table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-600" />
                  Faculty Recipient Status ({selectedNotice.recipients?.length || 0})
                </h3>

                {(!selectedNotice.recipients || selectedNotice.recipients.length === 0) ? (
                  <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                    No recipients assigned to this notice yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">{t('reports.recipient')}</th>
                            <th className="px-4 py-2.5">{t('reports.readAt')}</th>
                            <th className="px-4 py-2.5">{t('reports.acknowledgedAt')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedNotice.recipients.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">
                                  {rec.recipient?.name || `Faculty #${rec.recipient_id}`}
                                </div>
                                <div className="text-slate-400 text-[11px]">
                                  {rec.recipient?.department?.name || rec.recipient?.subject || rec.recipient?.email}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {rec.is_read ? (
                                  <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                                    {rec.read_at ? new Date(rec.read_at).toLocaleString() : t('notices.read')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    {t('notices.unread')}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {rec.is_acknowledged ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    {rec.acknowledged_at
                                      ? new Date(rec.acknowledged_at).toLocaleString()
                                      : t('notices.acknowledged')}
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-medium">
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
