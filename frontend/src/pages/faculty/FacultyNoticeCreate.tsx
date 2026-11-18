import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Department } from '../../types/department';
import { NoticePriority, NoticeLanguage, NLPAnalysis } from '../../types/notice';
import { NLPPreviewBox } from '../../components/NLPPreviewBox';
import {
  FilePlus2,
  Sparkles,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  UploadCloud,
  FileText,
} from 'lucide-react';

export const FacultyNoticeCreate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeLanguage, setNoticeLanguage] = useState<NoticeLanguage>('mr');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [targetAudience, setTargetAudience] = useState<string>('all_faculty');
  const [targetDeptId, setTargetDeptId] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [nlpAnalysis, setNlpAnalysis] = useState<NLPAnalysis | null>(null);
  const [analyzingNLP, setAnalyzingNLP] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api.departments.getDepartments().then(setDepartments).catch(console.error);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback(null);
    setError(null);

    try {
      const res = await api.notices.uploadDocument(file);
      setAttachmentUrl(res.attachment_url);

      if (res.extracted_text && res.extracted_text.trim()) {
        setContent(res.extracted_text);
        setUploadFeedback(`Document "${file.name}" uploaded. Text extracted successfully.`);
        const analysisRes = await api.notices.analyzeNLP(res.extracted_text);
        setNlpAnalysis(analysisRes);
      } else {
        setUploadFeedback(
          res.message ||
            `Document "${file.name}" attached. Automated extraction unavailable for this format; please enter or verify text below.`
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyzeNLP = async () => {
    if (!content.trim()) {
      setError('Please enter notice content before running NLP analysis.');
      return;
    }
    try {
      setAnalyzingNLP(true);
      setError(null);
      const res = await api.notices.analyzeNLP(content);
      setNlpAnalysis(res);
    } catch (err: any) {
      setError(err.message || 'NLP analysis service currently unavailable.');
    } finally {
      setAnalyzingNLP(false);
    }
  };

  const handleSubmit = async (submitForReview: boolean) => {
    if (!title.trim() || !content.trim()) {
      setError('Title and notice content are mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create notice draft
      const createdNotice = await api.notices.createNotice({
        title,
        original_text: content,
        notice_language: noticeLanguage,
        priority,
        source_type: 'faculty',
        attachment_url: attachmentUrl || undefined,
        target_audience: targetAudience,
        target_department_id: targetDeptId ? Number(targetDeptId) : null,
      });

      // 2. If user clicked "Submit for Approval", submit immediately
      if (submitForReview) {
        await api.notices.submitNotice(createdNotice.id);
        setSuccessMsg('Notice submitted successfully for Administrator/Principal review.');
      } else {
        setSuccessMsg('Notice draft saved successfully.');
      }

      setTimeout(() => {
        navigate('/faculty/my-submissions');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FilePlus2 className="w-6 h-6 text-brand-600" />
          {t('nav.createNotice')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Compose academic or departmental notices for school distribution. Notices are submitted to the Principal/Admin for review.
        </p>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Form & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          {/* Notice Language Selection (Distinct from UI Language) */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                {t('notices.noticeLanguage')}
              </label>
              <span className="text-[11px] text-amber-700 font-medium">Original Script</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNoticeLanguage('mr')}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  noticeLanguage === 'mr'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                मराठी (Marathi)
              </button>
              <button
                type="button"
                onClick={() => setNoticeLanguage('en')}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  noticeLanguage === 'en'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setNoticeLanguage('hi')}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  noticeLanguage === 'hi'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>

          {/* Document Upload Zone */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-brand-600" />
              Upload Circular Document (Optional)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Upload PDF, text, or scanned circulars. Supported formats will be automatically extracted, or you can enter and verify text manually below.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
              {isUploading && <span className="text-xs text-brand-600 animate-pulse">Uploading & extracting...</span>}
            </div>

            {uploadFeedback && (
              <div className="mt-2 text-xs p-2 bg-white rounded border border-slate-200 text-slate-700 flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                <span>{uploadFeedback}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('notices.title')} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('notices.titlePlaceholder')}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          {/* Priority & Target Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('notices.priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as NoticePriority)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
              >
                <option value="normal">{t('priorities.normal')}</option>
                <option value="urgent">{t('priorities.urgent')}</option>
                <option value="emergency">{t('priorities.emergency')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('notices.audience')}
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
              >
                <option value="all_faculty">{t('notices.allAudiences')}</option>
                <option value="department">{t('notices.byDepartment')}</option>
              </select>
            </div>
          </div>

          {targetAudience === 'department' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Department
              </label>
              <select
                value={targetDeptId}
                onChange={(e) => setTargetDeptId(e.target.value)}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
              >
                <option value="">-- Choose Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notice Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                {t('notices.content')} *
              </label>
              <span className="text-[11px] text-slate-400">
                {content.length} characters
              </span>
            </div>
            <textarea
              rows={8}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('notices.contentPlaceholder')}
              className="w-full text-sm p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden font-sans"
            />
          </div>

          {/* Attachment Link */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('notices.attachmentUrl')}
            </label>
            <input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          {/* Trigger NLP Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={analyzingNLP || !content.trim()}
              onClick={handleAnalyzeNLP}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-800 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              {analyzingNLP ? t('common.loading') : t('notices.previewNLP')}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {t('notices.saveDraft')}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {t('notices.submitForApproval')}
            </button>
          </div>
        </div>

        {/* Right Column: NLP Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              NLP Intelligence Assistant
            </h4>
            <p>
              When you write your notice in Marathi, the NLP pipeline automatically classifies its category (e.g., Examination, Meeting, Holiday), extracts scheduled dates/deadlines, and recommends recipient departments.
            </p>
          </div>

          <NLPPreviewBox
            analysis={nlpAnalysis}
            loading={analyzingNLP}
            noticeLanguage={noticeLanguage}
          />
        </div>
      </div>
    </div>
  );
};
