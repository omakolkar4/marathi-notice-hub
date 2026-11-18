import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Notice, NoticePriority } from '../../types/notice';
import { Department } from '../../types/department';
import { User } from '../../types/auth';
import { NLPPreviewBox } from '../../components/NLPPreviewBox';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  AlertCircle,
  Clock,
  Eye,
  Check,
  Building2,
  Users,
  AlertTriangle,
  History,
  FileText,
} from 'lucide-react';

export const NoticeApprovalPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'submitted' | 'approved'>('submitted');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Distribution State in Modal
  const [showDistributeSection, setShowDistributeSection] = useState(false);
  const [targetAudience, setTargetAudience] = useState<
    'all_faculty' | 'department' | 'subject' | 'selected_faculty'
  >('all_faculty');
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
  const [targetSubject, setTargetSubject] = useState('');
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [facultyList, setFacultyList] = useState<User[]>([]);

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      const data = await api.notices.getNotices({ approval_status: activeTab });
      // If approved tab, show notices that are pending distribution
      const filtered =
        activeTab === 'approved'
          ? data.filter((n) => n.distribution_status === 'pending')
          : data;
      setNotices(filtered);
    } catch (err) {
      console.error('Failed to load notices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [activeTab]);

  useEffect(() => {
    const loadPrereqs = async () => {
      try {
        const [depts, faculty] = await Promise.all([
          api.departments.getDepartments(),
          api.users.getUsers({ role: 'Faculty', is_active: true }),
        ]);
        setDepartments(depts);
        setFacultyList(faculty);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    };
    loadPrereqs();
  }, []);

  const handleOpenReview = (notice: Notice) => {
    setSelectedNotice(notice);
    setComment('');
    setShowDistributeSection(notice.approval_status === 'approved');

    // Prepopulate recipient audience if present on notice or NLP
    if (notice.target_audience) {
      setTargetAudience(notice.target_audience as any);
      if (notice.target_department_id) setSelectedDeptId(notice.target_department_id);
      if (notice.target_subject) setTargetSubject(notice.target_subject);
    } else if (notice.nlp_analysis?.suggested_recipients?.length) {
      const first = notice.nlp_analysis.suggested_recipients[0];
      if (first.recipient_type === 'ALL_FACULTY') {
        setTargetAudience('all_faculty');
      } else if (first.recipient_type === 'DEPARTMENT' && first.department_or_subject) {
        setTargetAudience('department');
        const dept = departments.find((d) =>
          d.name.toLowerCase().includes(first.department_or_subject!.toLowerCase())
        );
        if (dept) setSelectedDeptId(dept.id);
      } else if (first.recipient_type === 'SUBJECT_TEACHER' && first.department_or_subject) {
        setTargetAudience('subject');
        setTargetSubject(first.department_or_subject);
      }
    }
  };

  const handleDecision = async (decision: 'approved' | 'rejected' | 'returned') => {
    if (!selectedNotice) return;
    setIsSubmitting(true);
    try {
      await api.notices.approveNotice(selectedNotice.id, decision, comment);
      setFeedbackMsg(`Notice #${selectedNotice.id} successfully ${decision}!`);
      setSelectedNotice(null);
      setComment('');
      fetchNotices();
    } catch (err: any) {
      alert(err.message || 'Approval action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveAndDistribute = async () => {
    if (!selectedNotice) return;
    setIsSubmitting(true);
    try {
      // 1. If currently submitted, approve first
      if (selectedNotice.approval_status !== 'approved') {
        await api.notices.approveNotice(selectedNotice.id, 'approved', comment || 'Approved for distribution');
      }

      // 2. Distribute notice
      await api.notices.distributeNotice(
        selectedNotice.id,
        targetAudience,
        targetAudience === 'department' ? selectedDeptId : undefined,
        targetAudience === 'subject' ? targetSubject : undefined,
        targetAudience === 'selected_faculty' ? selectedFacultyIds : undefined
      );

      setFeedbackMsg(`Notice #${selectedNotice.id} approved and distributed to faculty!`);
      setSelectedNotice(null);
      fetchNotices();
    } catch (err: any) {
      alert(err.message || 'Distribution failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFacultySelection = (id: number) => {
    setSelectedFacultyIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-6 h-6 text-brand-600" />
          <span>{t('nav.pendingApprovals')}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review faculty circulars, verify automated NLP recipient recommendations, and authorize school-wide or departmental distribution.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'submitted'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('status.submitted')}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'approved'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('status.approved')} (Pending Distribution)
        </button>
      </div>

      {/* Success Banner */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Notices List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('common.loading')}
          </div>
        ) : notices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No notices awaiting action in this category
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All submitted circulars have been reviewed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="p-5 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        notice.approval_status === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {t(`status.${notice.approval_status}`)}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                      {t(`categories.${notice.predicted_category}`, notice.predicted_category || 'General')}
                    </span>
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
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    {notice.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {notice.original_text}
                  </p>

                  <div className="text-xs text-slate-400 flex items-center gap-4 pt-1">
                    <span>{t('notices.createdOn')}: {new Date(notice.created_at).toLocaleDateString()}</span>
                    <span>Source: {notice.source_type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenReview(notice)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{notice.approval_status === 'approved' ? 'Distribute' : 'Review & Act'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review & Distribution Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 mb-1 inline-block">
                  Notice #{selectedNotice.id} • {selectedNotice.source_type}
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedNotice.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Original Notice Content */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {t('notices.content')}
              </span>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-devanagari">
                {selectedNotice.original_text}
              </p>
              {selectedNotice.attachment_url && (
                <div className="pt-2 text-xs flex items-center gap-1.5 text-brand-600">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Attachment: </span>
                  <a
                    href={selectedNotice.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {selectedNotice.attachment_url}
                  </a>
                </div>
              )}
            </div>

            {/* Attached Automated NLP Analysis */}
            {selectedNotice.nlp_analysis && (
              <NLPPreviewBox nlpAnalysis={selectedNotice.nlp_analysis} noticeLanguage={selectedNotice.notice_language || 'mr'} />
            )}

            {/* Administrator Review Comment */}
            {selectedNotice.approval_status !== 'approved' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reviewer Comments / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add revision instructions or approval notes for the author..."
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}

            {/* Target Audience & Recipient Selection Section */}
            {(showDistributeSection || selectedNotice.approval_status === 'approved') && (
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Configure Notice Distribution Audience
                  </label>
                  {selectedNotice.nlp_analysis?.review_required && (
                    <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Recipient review recommended
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'all_faculty', label: t('notices.allAudiences') },
                    { id: 'department', label: t('notices.byDepartment') },
                    { id: 'subject', label: t('notices.bySubject') },
                    { id: 'selected_faculty', label: t('notices.selectedFaculty') },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setTargetAudience(aud.id as any)}
                      className={`p-2.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                        targetAudience === aud.id
                          ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                {targetAudience === 'department' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Select Department:
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(Number(e.target.value))}
                      className="w-full sm:w-80 text-sm bg-white border border-slate-300 rounded-xl px-3 py-2"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetAudience === 'subject' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Subject Name:
                    </label>
                    <input
                      type="text"
                      value={targetSubject}
                      onChange={(e) => setTargetSubject(e.target.value)}
                      placeholder="e.g. Mathematics"
                      className="w-full sm:w-80 text-sm bg-white border border-slate-300 rounded-xl px-3 py-2"
                    />
                  </div>
                )}

                {targetAudience === 'selected_faculty' && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">
                      Select faculty members:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {facultyList.map((f) => (
                        <label
                          key={f.id}
                          className="flex items-center gap-2 text-xs text-slate-700 p-1.5 rounded border border-slate-100 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFacultyIds.includes(f.id)}
                            onChange={() => toggleFacultySelection(f.id)}
                            className="rounded text-brand-600"
                          />
                          <span>{f.name} ({f.subject || f.department?.name || 'Faculty'})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                {t('common.cancel')}
              </button>

              {selectedNotice.approval_status === 'submitted' && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('returned')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('notices.returnBtn')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('rejected')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t('notices.rejectBtn')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDecision('approved')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve (Save Draft)</span>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApproveAndDistribute}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Approve & Distribute</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
