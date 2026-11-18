import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Department } from '../../types/department';
import { User } from '../../types/auth';
import { NLPAnalysis, NoticePriority } from '../../types/notice';
import { NLPPreviewBox } from '../../components/NLPPreviewBox';
import {
  FilePlus2,
  Sparkles,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  Building2,
  Users,
  UploadCloud,
  FileText,
  Calendar,
  Check,
  AlertTriangle,
} from 'lucide-react';

export const AdminNoticeCreate: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeLanguage, setNoticeLanguage] = useState<'mr' | 'en' | 'hi'>('mr');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [sourceType, setSourceType] = useState('management');
  const [sourceOrganization, setSourceOrganization] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [targetAudience, setTargetAudience] = useState<
    'all_faculty' | 'department' | 'subject' | 'selected_faculty'
  >('all_faculty');
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
  const [targetSubject, setTargetSubject] = useState('');
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<number[]>([]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [facultyList, setFacultyList] = useState<User[]>([]);

  const [nlpAnalysis, setNlpAnalysis] = useState<NLPAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const [depts, faculty] = await Promise.all([
          api.departments.getDepartments(),
          api.users.getUsers({ role: 'Faculty', is_active: true }),
        ]);
        setDepartments(depts);
        setFacultyList(faculty);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load departments or faculty:', err);
      }
    };
    loadPrerequisites();
  }, []);

  // Handle document upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback(null);
    setErrorMsg(null);

    try {
      const res = await api.notices.uploadDocument(file);
      setAttachmentUrl(res.attachment_url);

      if (res.extracted_text && res.extracted_text.trim()) {
        setContent(res.extracted_text);
        setUploadFeedback(`Document "${file.name}" uploaded. Text extracted successfully.`);
        // Run live NLP analysis
        const analysisRes = await api.notices.analyzeNLP(res.extracted_text);
        setNlpAnalysis(analysisRes);
      } else {
        setUploadFeedback(
          res.message ||
            `Document "${file.name}" attached. Text could not be automatically extracted; please enter or verify notice content below.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger live NLP preview
  const handleAnalyzeNLP = async () => {
    if (!content.trim()) {
      setErrorMsg('Please write notice content before running NLP analysis.');
      return;
    }
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const res = await api.notices.analyzeNLP(content);
      setNlpAnalysis(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'NLP analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply NLP suggestion to recipient selection
  const handleApplyNLPSuggestion = () => {
    if (!nlpAnalysis?.suggested_recipients || nlpAnalysis.suggested_recipients.length === 0) return;

    const first = nlpAnalysis.suggested_recipients[0];
    if (first.recipient_type === 'ALL_FACULTY') {
      setTargetAudience('all_faculty');
    } else if (first.recipient_type === 'DEPARTMENT' && first.department_or_subject) {
      setTargetAudience('department');
      const dept = departments.find(
        (d) => d.name.toLowerCase().includes(first.department_or_subject!.toLowerCase())
      );
      if (dept) setSelectedDeptId(dept.id);
    } else if (first.recipient_type === 'SUBJECT_TEACHER' && first.department_or_subject) {
      setTargetAudience('subject');
      setTargetSubject(first.department_or_subject);
    }
  };

  const handleCreateAndDistribute = async (shouldDistribute: boolean) => {
    if (!title.trim()) {
      setErrorMsg('Notice title is required.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Notice content is required.');
      return;
    }

    if (shouldDistribute && targetAudience === 'selected_faculty' && selectedFacultyIds.length === 0) {
      setErrorMsg('Please select at least one faculty recipient for selected faculty distribution.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Create notice (backend runs NLP and stores draft)
      const newNotice = await api.notices.createNotice({
        title,
        original_text: content,
        notice_language: noticeLanguage,
        priority,
        source_type: sourceType,
        source_organization: sourceType === 'higher_authority' ? sourceOrganization : undefined,
        source_date: sourceType === 'higher_authority' ? sourceDate : undefined,
        attachment_url: attachmentUrl || undefined,
        target_audience: targetAudience,
        target_department_id: targetAudience === 'department' ? selectedDeptId : null,
        target_subject: targetAudience === 'subject' ? targetSubject : null,
      });

      // 2. If Administrator chooses immediate distribution
      if (shouldDistribute) {
        // Approve notice first
        await api.notices.approveNotice(newNotice.id, 'approved', 'Authorized for distribution by Admin');
        // Distribute to audience
        await api.notices.distributeNotice(
          newNotice.id,
          targetAudience,
          targetAudience === 'department' ? selectedDeptId : undefined,
          targetAudience === 'subject' ? targetSubject : undefined,
          targetAudience === 'selected_faculty' ? selectedFacultyIds : undefined
        );
        setSuccessMsg('Notice successfully created, approved, and distributed to faculty!');
      } else {
        setSuccessMsg('Notice draft created successfully.');
      }

      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create notice');
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FilePlus2 className="w-6 h-6 text-brand-600" />
          <span>{t('nav.createNotice')}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Draft official circulars or publish directives received from higher school authorities.
        </p>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            {t('notices.title')} *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('notices.titlePlaceholder')}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Notice Language & Priority & Source */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Notice Language Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('notices.noticeLanguage')}
            </label>
            <select
              value={noticeLanguage}
              onChange={(e) => setNoticeLanguage(e.target.value as any)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="mr">मराठी (Marathi)</option>
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('notices.priority')}
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as NoticePriority)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="normal">{t('priorities.normal')}</option>
              <option value="urgent">{t('priorities.urgent')}</option>
              <option value="emergency">{t('priorities.emergency')}</option>
            </select>
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('notices.sourceType')}
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="management">School Management</option>
              <option value="higher_authority">Higher Education Authority (Z.P. / Govt)</option>
            </select>
          </div>
        </div>

        {/* Higher Authority Details (Shown when sourceType === 'higher_authority') */}
        {sourceType === 'higher_authority' && (
          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-amber-700" />
              <span>Higher Authority Document Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issuing Authority / Organization:
                </label>
                <input
                  type="text"
                  value={sourceOrganization}
                  onChange={(e) => setSourceOrganization(e.target.value)}
                  placeholder="e.g. शिक्षण विभाग, जिल्हा परिषद / Maharashtra State Board"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Reference No. / Letter Date:
                </label>
                <input
                  type="text"
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                  placeholder="e.g. जावक क्र. १२३/२०२४, दिनांक १५/१०/२०२४"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Document Upload Zone */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-brand-600" />
            <span>Upload Original Document / Circular (Optional)</span>
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={isUploading}
              accept=".txt,.pdf,.docx,.doc,.png,.jpg,.jpeg"
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
            {isUploading && (
              <span className="text-xs text-brand-600 font-semibold flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-600"></span>
                Processing document...
              </span>
            )}
          </div>
          {attachmentUrl && (
            <div className="mt-2 text-xs text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>Attached: </span>
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                {attachmentUrl}
              </a>
            </div>
          )}
          {uploadFeedback && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
              {uploadFeedback}
            </div>
          )}
        </div>

        {/* Notice Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('notices.content')} *
            </label>
            <button
              type="button"
              disabled={isAnalyzing || !content.trim()}
              onClick={handleAnalyzeNLP}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzing ? 'Analyzing...' : t('notices.previewNLP')}</span>
            </button>
          </div>
          <textarea
            rows={6}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('notices.contentPlaceholder')}
            className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl p-4 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-devanagari leading-relaxed"
          />
        </div>

        {/* Live NLP Preview Box */}
        {nlpAnalysis && (
          <div className="space-y-3">
            <NLPPreviewBox nlpAnalysis={nlpAnalysis} noticeLanguage={noticeLanguage} />

            {/* Smart NLP Suggestion One-Click Apply */}
            {nlpAnalysis.suggested_recipients && nlpAnalysis.suggested_recipients.length > 0 && (
              <div className="bg-brand-50/80 p-3 rounded-xl border border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-brand-900">
                  <span className="font-bold">NLP Recommendation: </span>
                  {nlpAnalysis.suggested_recipients.map((r, i) => (
                    <span key={i} className="font-semibold text-brand-700">
                      {r.department_or_subject || r.recipient_type}{' '}
                    </span>
                  ))}
                </div>
                {!nlpAnalysis.review_required && (
                  <button
                    type="button"
                    onClick={handleApplyNLPSuggestion}
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Suggestion</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Target Audience & Distribution Options */}
        <div className="border-t border-slate-200 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              {t('notices.audience')}
            </label>
            {nlpAnalysis?.review_required && (
              <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Manual recipient review required
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
                className={`p-3 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer ${
                  targetAudience === aud.id
                    ? 'bg-brand-50 border-brand-500 text-brand-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {aud.label}
              </button>
            ))}
          </div>

          {/* Department Dropdown if targetAudience === 'department' */}
          {targetAudience === 'department' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Select School Department:
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(Number(e.target.value))}
                className="w-full sm:w-80 text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject Field if targetAudience === 'subject' */}
          {targetAudience === 'subject' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Enter Subject Name (e.g. Mathematics, Science):
              </label>
              <input
                type="text"
                value={targetSubject}
                onChange={(e) => setTargetSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full sm:w-80 text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
              />
            </div>
          )}

          {/* Selected Faculty Checkboxes if targetAudience === 'selected_faculty' */}
          {targetAudience === 'selected_faculty' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-48 overflow-y-auto space-y-2">
              <span className="text-xs font-semibold text-slate-500 block mb-2">
                Select individual faculty members:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {facultyList.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-brand-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFacultyIds.includes(f.id)}
                      onChange={() => toggleFacultySelection(f.id)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <span>
                      {f.name} ({f.subject || f.department?.name || 'Faculty'})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleCreateAndDistribute(false)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{t('notices.saveDraft')}</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleCreateAndDistribute(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{t('notices.distributeBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
