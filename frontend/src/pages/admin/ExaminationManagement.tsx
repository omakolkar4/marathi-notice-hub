import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import {
  Examination,
  ExaminationDuty,
  QRCheckInToken,
  FacultyCheckInRecord,
  LateWarningRecord,
  ExaminationIncidentReport,
  ExaminationAttendanceReportItem,
  ExaminationCreatePayload,
  ExaminationUpdatePayload,
} from '../../types/examination';
import { User } from '../../types/auth';
import { Modal } from '../../components/Modal';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  UserCheck,
  AlertTriangle,
  FileCheck2,
  Plus,
  RefreshCw,
  Printer,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Edit2,
  Trash2,
  Ban,
  Eye,
} from 'lucide-react';

export const ExaminationManagement: React.FC = () => {
  const { t } = useTranslation();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'schedules' | 'monitor' | 'incidents' | 'report'>('schedules');

  // Core Data
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [facultyList, setFacultyList] = useState<User[]>([]);
  const [incidents, setIncidents] = useState<ExaminationIncidentReport[]>([]);
  const [warnings, setWarnings] = useState<LateWarningRecord[]>([]);
  const [reportItems, setReportItems] = useState<ExaminationAttendanceReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isIncidentReviewModalOpen, setIsIncidentReviewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Selected entities for modals
  const [selectedExam, setSelectedExam] = useState<Examination | null>(null);
  const [examToDelete, setExamToDelete] = useState<Examination | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editExamData, setEditExamData] = useState<ExaminationUpdatePayload>({
    title: '',
    exam_date: '',
    reporting_time: '',
    collection_deadline: '',
    grace_period_minutes: 10,
    location: '',
    instructions: '',
  });
  const [selectedCheckin, setSelectedCheckin] = useState<FacultyCheckInRecord | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<ExaminationIncidentReport | null>(null);

  // Form states
  const [newExam, setNewExam] = useState<ExaminationCreatePayload>({
    title: '',
    exam_code: '',
    exam_date: new Date().toISOString().split('T')[0],
    reporting_time: '09:30',
    collection_deadline: '10:00',
    grace_period_minutes: 10,
    location: '',
    instructions: '',
  });

  const [dutyForm, setDutyForm] = useState({
    faculty_id: 0,
    role_title: 'Senior Supervisor',
    notes: '',
  });

  const [correctionForm, setCorrectionForm] = useState({
    status: 'excused' as 'excused' | 'corrected',
    reason: '',
  });

  const [reviewForm, setReviewForm] = useState({
    status: 'resolved' as 'reviewed' | 'resolved' | 'dismissed',
    remarks: '',
  });

  const [newBucketLabel, setNewBucketLabel] = useState('');

  // Initial Data Load
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [examsData, usersData, incidentsData, warningsData, reportData] = await Promise.all([
        api.examinations.getExaminations(),
        api.users.getUsers({ role: 'Faculty', is_active: true }),
        api.examinations.getIncidents(),
        api.examinations.getWarnings(),
        api.examinations.getAttendanceReport(),
      ]);

      setExaminations(examsData);
      setFacultyList(usersData);
      setIncidents(incidentsData);
      setWarnings(warningsData);
      setReportItems(reportData);

      if (selectedExam) {
        const refreshedSelected = examsData.find((e) => e.id === selectedExam.id);
        if (refreshedSelected) setSelectedExam(refreshedSelected);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load examination management data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Schedule Exam Handler
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.examinations.createExamination(newExam);
      setIsCreateModalOpen(false);
      setNewExam({
        title: '',
        exam_code: '',
        exam_date: new Date().toISOString().split('T')[0],
        reporting_time: '09:30',
        collection_deadline: '10:00',
        grace_period_minutes: 10,
        location: '',
        instructions: '',
      });
      showNotification('Examination session scheduled successfully with authorized QR bucket token!');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule examination.');
    }
  };

  // Assign Faculty Handler
  const handleAssignDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !dutyForm.faculty_id) return;
    setError(null);
    try {
      await api.examinations.assignDuty(selectedExam.id, {
        faculty_id: Number(dutyForm.faculty_id),
        role_title: dutyForm.role_title,
        notes: dutyForm.notes,
      });
      setIsAssignModalOpen(false);
      setDutyForm({ faculty_id: 0, role_title: 'Senior Supervisor', notes: '' });
      showNotification('Faculty member assigned to examination duty successfully!');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign duty.');
    }
  };

  // Generate additional QR Token
  const handleGenerateQR = async () => {
    if (!selectedExam) return;
    try {
      const newToken = await api.examinations.generateQRToken(selectedExam.id, newBucketLabel || undefined);
      setNewBucketLabel('');
      showNotification('New authorized QR bucket token generated!');
      const updatedTokens = [...(selectedExam.qr_tokens || []), newToken];
      setSelectedExam({
        ...selectedExam,
        qr_tokens: updatedTokens,
        qr_tokens_count: updatedTokens.length,
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR token.');
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (exam: Examination) => {
    setSelectedExam(exam);
    setEditExamData({
      title: exam.title,
      exam_date: exam.exam_date,
      reporting_time: exam.reporting_time,
      collection_deadline: exam.collection_deadline,
      grace_period_minutes: exam.grace_period_minutes,
      location: exam.location,
      instructions: exam.instructions || '',
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit Exam
  const handleEditExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    setError(null);
    try {
      await api.examinations.updateExamination(selectedExam.id, editExamData);
      setIsEditModalOpen(false);
      showNotification('Examination updated successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update examination.');
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (exam: Examination) => {
    setSelectedExam(exam);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancel Exam
  const handleCancelExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    setError(null);
    try {
      await api.examinations.cancelExamination(selectedExam.id, cancelReason);
      setIsCancelModalOpen(false);
      setCancelReason('');
      showNotification('Examination cancelled successfully.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel examination.');
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (exam: Examination) => {
    setExamToDelete(exam);
    setIsDeleteModalOpen(true);
  };

  // Submit Safe Delete Exam
  const handleDeleteExamSubmit = async () => {
    if (!examToDelete) return;
    setError(null);
    try {
      await api.examinations.deleteExamination(examToDelete.id);
      setIsDeleteModalOpen(false);
      setExamToDelete(null);
      showNotification('Examination deleted safely.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Cannot delete examination with recorded check-ins or incidents. Cancel the examination instead.');
    }
  };

  // Download QR SVG
  const handleDownloadSVG = (token: QRCheckInToken) => {
    if (!token.qr_svg_content) return;
    const blob = new Blob([token.qr_svg_content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${selectedExam?.exam_code || 'EXAM'}_${token.bucket_identifier || 'bucket'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Print QR Sheet
  const handlePrintToken = (token: QRCheckInToken) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Bucket Token - ${selectedExam?.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; text-align: center; margin: 0; padding: 24px; color: #1e293b; }
            .card { border: 2px solid #0284c7; border-radius: 16px; padding: 24px; max-width: 440px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .school { font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .title { font-size: 20px; font-weight: bold; margin-bottom: 6px; }
            .meta { font-size: 13px; color: #64748b; margin-bottom: 4px; }
            .bucket { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 14px; padding: 4px 12px; border-radius: 9999px; margin: 10px 0; }
            .qr-box { width: 240px; height: 240px; margin: 12px auto; padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }
            .qr-box svg { width: 100%; height: 100%; display: block; }
            .token-str { font-family: monospace; font-size: 11px; background: #f1f5f9; padding: 6px 10px; border-radius: 6px; word-break: break-all; margin: 8px 0; color: #475569; }
            .note { font-size: 11px; color: #94a3b8; margin-top: 10px; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="school">Marathi Notice Hub — Examination Management</div>
            <div class="title">${selectedExam?.title}</div>
            <div class="meta">Code: <strong>${selectedExam?.exam_code}</strong> | Date: <strong>${selectedExam?.exam_date}</strong></div>
            <div class="meta">Reporting: <strong>${selectedExam?.reporting_time}</strong> | Hall: <strong>${selectedExam?.location}</strong></div>
            <div class="bucket">Bucket: ${token.bucket_label || token.bucket_identifier || 'Main Question Paper Bucket'}</div>
            <div class="qr-box">${token.qr_svg_content}</div>
            <div class="token-str">${token.token}</div>
            <div class="note">Authorized faculty must scan this QR code using the Faculty Portal camera to verify question paper bucket collection.</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Administrative Correction Handler
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheckin) return;
    try {
      await api.examinations.correctCheckIn(selectedCheckin.id, correctionForm);
      setIsCorrectionModalOpen(false);
      setCorrectionForm({ status: 'excused', reason: '' });
      showNotification('Check-in record corrected and audit log recorded.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save correction.');
    }
  };

  // Incident Review Handler
  const handleIncidentReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      await api.examinations.reviewIncident(selectedIncident.id, reviewForm);
      setIsIncidentReviewModalOpen(false);
      setReviewForm({ status: 'resolved', remarks: '' });
      showNotification('Incident report reviewed and status updated.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit incident review.');
    }
  };

  // CSV Export for Examination Attendance Report
  const handleExportCSV = () => {
    if (reportItems.length === 0) return;
    const headers = [
      'Exam ID',
      'Exam Title',
      'Exam Code',
      'Date',
      'Reporting Time',
      'Location',
      'Faculty ID',
      'Faculty Name',
      'Department',
      'Role',
      'Duty Status',
      'Scanned At',
      'Late?',
      'Minutes Late',
      'Active Warnings',
      'Incident Status',
    ];

    const rows = reportItems.map((r) => [
      r.examination_id,
      `"${r.exam_title.replace(/"/g, '""')}"`,
      r.exam_code,
      r.exam_date,
      r.reporting_time,
      `"${r.location.replace(/"/g, '""')}"`,
      r.faculty_id,
      `"${r.faculty_name.replace(/"/g, '""')}"`,
      `"${(r.department_name || '').replace(/"/g, '""')}"`,
      `"${r.role_title.replace(/"/g, '""')}"`,
      r.duty_status,
      r.scanned_at || 'Pending',
      r.is_late ? 'Yes' : 'No',
      r.minutes_late,
      r.active_warnings_count,
      r.incident_status || 'None',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Examination_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredExams = examinations.filter(
    (e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.exam_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{t('examinations.title')}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Phase 6 Active
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{t('examinations.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('examinations.scheduleExam')}</span>
          </button>
          <button
            onClick={fetchData}
            title={t('common.refresh')}
            className="p-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'schedules'
              ? 'border-brand-600 text-brand-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('examinations.scheduled')} ({examinations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('monitor')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'monitor'
              ? 'border-brand-600 text-brand-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('examinations.checkInStatus')}</span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'incidents'
              ? 'border-brand-600 text-brand-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>
            {t('examinations.warningsAndIncidents')} ({incidents.length + warnings.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
            activeTab === 'report'
              ? 'border-brand-600 text-brand-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('examinations.attendanceReport')}</span>
        </button>
      </div>

      {/* TAB 1: Examination Schedules */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search examination title, code, or location..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredExams.length} of {examinations.length} examination sessions
            </div>
          </div>

          {filteredExams.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">{t('examinations.noExams')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredExams.map((exam) => (
                <div
                  key={exam.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                          {exam.exam_code}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">{exam.title}</h3>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 capitalize">
                        {exam.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Date: <strong>{exam.exam_date}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Reporting: <strong>{exam.reporting_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">Hall: <strong>{exam.location}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Grace: <strong>+{exam.grace_period_minutes}m</strong></span>
                      </div>
                    </div>

                    {exam.instructions && (
                      <p className="text-xs text-slate-500 line-clamp-2 italic">
                        "{exam.instructions}"
                      </p>
                    )}

                    {/* Assigned duties preview */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="font-semibold text-slate-700">
                          {t('examinations.assignedFaculty')} ({exam.duties?.length || 0}):
                        </span>
                        <span className="text-brand-600 font-medium">
                          {exam.qr_tokens?.length || 0} QR Bucket Token(s)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {exam.duties && exam.duties.length > 0 ? (
                          exam.duties.map((duty) => (
                            <span
                              key={duty.id}
                              className={`px-2 py-0.5 text-xs rounded-full border ${
                                duty.status === 'checked_in_ontime'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : duty.status === 'checked_in_late'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : duty.status === 'excused'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {duty.faculty?.name || `Faculty #${duty.faculty_id}`} ({duty.role_title})
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">No faculty members assigned yet.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-3 mt-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsDetailModalOpen(true);
                        }}
                        title="View Details"
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(exam)}
                        title="Edit Examination"
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsAssignModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assign</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsQRModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR Tokens ({exam.qr_tokens?.length || 0})</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {exam.status !== 'cancelled' && (
                        <button
                          onClick={() => handleOpenCancelModal(exam)}
                          title="Cancel Examination"
                          className="px-2 py-1.5 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-medium transition inline-flex items-center gap-1 border border-amber-200"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenDeleteModal(exam)}
                        title="Delete Examination"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition border border-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Check-In Monitor & Corrections */}
      {activeTab === 'monitor' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-brand-600" />
              <span>Real-Time Check-In & Duty Verification</span>
            </h2>
            <div className="text-xs text-slate-500">
              Only authorized administrators can excuse or modify official examination attendance.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Exam Session</th>
                  <th className="px-4 py-3">Faculty Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Reporting Time</th>
                  <th className="px-4 py-3">Scanned Check-in</th>
                  <th className="px-4 py-3">Punctuality Result</th>
                  <th className="px-4 py-3 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No duty assignments recorded yet.
                    </td>
                  </tr>
                ) : (
                  reportItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.exam_title}</div>
                        <div className="text-xs text-slate-400 font-mono">{item.exam_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.faculty_name}</div>
                        <div className="text-xs text-slate-400">{item.department_name || 'General Faculty'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                        {item.role_title}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">
                        {item.reporting_time}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {item.scanned_at ? (
                          <span className="text-slate-900 font-semibold">
                            {new Date(item.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not scanned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.duty_status === 'checked_in_ontime' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('examinations.onTime')}</span>
                          </span>
                        )}
                        {item.duty_status === 'checked_in_late' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{item.minutes_late}m Late</span>
                          </span>
                        )}
                        {item.duty_status === 'excused' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('examinations.excused')}</span>
                          </span>
                        )}
                        {item.duty_status === 'assigned' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{t('examinations.pending')}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.is_late && item.duty_status !== 'excused' && (
                          <button
                            onClick={() => {
                              // Find checkin record
                              const exam = examinations.find((e) => e.id === item.examination_id);
                              const chk = exam?.checkins?.find((c) => c.faculty_id === item.faculty_id);
                              if (chk) {
                                setSelectedCheckin(chk);
                                setIsCorrectionModalOpen(true);
                              } else {
                                alert('Check-in record details loaded. Open session to view full check-in record.');
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md transition"
                          >
                            {t('examinations.administrativeCorrection')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Late Warnings & Incident Reports */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          {/* Statutory Disclaimer Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-bold">{t('examinations.incidentDisclaimer')}</p>
              <p className="text-xs text-amber-800 mt-1">
                Policy Rule: Strike 1 &rarr; Warning 1. Strike 2 &rarr; Warning 2. Strike 3 &rarr; Automated Incident Report submitted for review by the academic committee. No automatic disciplinary action is taken by software.
              </p>
            </div>
          </div>

          {/* Section A: Incident Reports (Strike 3) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>{t('examinations.incidentReports')} ({incidents.length})</span>
              </h3>
              <span className="text-xs text-slate-500">Requires Committee / Principal Review</span>
            </div>

            <div className="divide-y divide-slate-100">
              {incidents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No incident reports generated. Faculty punctuality is in good standing.
                </div>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.id} className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {inc.faculty?.name || `Faculty #${inc.faculty_id}`}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                          inc.status === 'open'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : inc.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          Status: {inc.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          Total Late Occurrences: <strong>{inc.total_late_occurrences}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{inc.incident_summary}</p>
                      {inc.admin_remarks && (
                        <p className="text-xs text-brand-700 bg-brand-50 p-2 rounded border border-brand-100">
                          <strong>Admin Remarks:</strong> {inc.admin_remarks}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedIncident(inc);
                        setReviewForm({ status: inc.status === 'open' ? 'resolved' : inc.status, remarks: inc.admin_remarks || '' });
                        setIsIncidentReviewModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition whitespace-nowrap self-start md:self-auto"
                    >
                      {t('examinations.reviewIncident')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section B: Warning Records (Strike 1 & 2) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Late Warning Records ({warnings.length})</span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {warnings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No late warnings issued.
                </div>
              ) : (
                warnings.map((w) => (
                  <div key={w.id} className="p-4 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                          Warning {w.warning_level}
                        </span>
                        <span className="font-semibold text-slate-800">
                          Faculty #{w.faculty_id}
                        </span>
                        <span className="text-xs text-slate-400">
                          Issued on {new Date(w.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{w.warning_reason}</p>
                      {w.excuse_reason && (
                        <p className="text-xs text-purple-700 italic mt-0.5">Excused: {w.excuse_reason}</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      w.status === 'active'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Attendance & Punctuality Export Report */}
      {activeTab === 'report' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">{t('examinations.attendanceReport')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                School-wide examination attendance, punctuality, and incident history report.
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{t('examinations.exportCSV')}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Examination</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Faculty Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Actual Scan</th>
                  <th className="px-4 py-3">Punctuality Status</th>
                  <th className="px-4 py-3">Active Warnings</th>
                  <th className="px-4 py-3">Incident Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportItems.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {r.exam_title} ({r.exam_code})
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      {r.exam_date} @ {r.reporting_time}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">
                      {r.faculty_name} ({r.department_name || 'Faculty'})
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.role_title}</td>
                    <td className="px-4 py-2.5 font-mono">
                      {r.scanned_at ? new Date(r.scanned_at).toLocaleTimeString() : 'Pending'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        r.duty_status === 'checked_in_ontime'
                          ? 'bg-emerald-50 text-emerald-700'
                          : r.duty_status === 'checked_in_late'
                          ? 'bg-amber-50 text-amber-700'
                          : r.duty_status === 'excused'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.duty_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-center">
                      {r.active_warnings_count}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.incident_status ? (
                        <span className="text-red-700 font-bold uppercase">{r.incident_status}</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Schedule Examination */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('examinations.scheduleExam')}
        isDirty={newExam.title !== '' || newExam.exam_code !== '' || newExam.location !== '' || newExam.instructions !== ''}
        maxWidth="xl"
      >
        <form onSubmit={handleCreateExam} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('examinations.examTitle')} *
            </label>
            <input
              type="text"
              required
              placeholder="उदा. इयत्ता १० वी गणित वार्षिक परीक्षा २०२४"
              value={newExam.title}
              onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.examCode')} *
              </label>
              <input
                type="text"
                required
                placeholder="SSC-2024-MATH-101"
                value={newExam.exam_code}
                onChange={(e) => setNewExam({ ...newExam, exam_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.examDate')} *
              </label>
              <input
                type="date"
                required
                value={newExam.exam_date}
                onChange={(e) => setNewExam({ ...newExam, exam_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.reportingTime')} *
              </label>
              <input
                type="time"
                required
                value={newExam.reporting_time}
                onChange={(e) => setNewExam({ ...newExam, reporting_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.collectionDeadline')} *
              </label>
              <input
                type="time"
                required
                value={newExam.collection_deadline}
                onChange={(e) => setNewExam({ ...newExam, collection_deadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.gracePeriod')}
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={newExam.grace_period_minutes}
                onChange={(e) => setNewExam({ ...newExam, grace_period_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('examinations.location')} *
            </label>
            <input
              type="text"
              required
              placeholder="Main Exam Hall A (Room 101)"
              value={newExam.location}
              onChange={(e) => setNewExam({ ...newExam, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('examinations.instructions')}
            </label>
            <textarea
              rows={2}
              placeholder="Specific bucket instructions, question paper sealed packet details..."
              value={newExam.instructions}
              onChange={(e) => setNewExam({ ...newExam, instructions: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition cursor-pointer"
            >
              {t('examinations.scheduleExam')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Assign Faculty Duty */}
      <Modal
        isOpen={isAssignModalOpen && selectedExam !== null}
        onClose={() => setIsAssignModalOpen(false)}
        title={t('examinations.assignDuty')}
        subtitle={selectedExam ? selectedExam.title : undefined}
        isDirty={dutyForm.faculty_id !== 0 || dutyForm.notes !== ''}
        maxWidth="md"
      >
        {selectedExam && (
          <form onSubmit={handleAssignDuty} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.selectFaculty')} *
              </label>
              <select
                required
                value={dutyForm.faculty_id}
                onChange={(e) => setDutyForm({ ...dutyForm, faculty_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value={0}>-- Select Faculty Member --</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.subject || 'Faculty'}) - {f.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.roleTitle')} *
              </label>
              <select
                value={dutyForm.role_title}
                onChange={(e) => setDutyForm({ ...dutyForm, role_title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="Senior Supervisor">Senior Supervisor (मुख्य पर्यवेक्षक)</option>
                <option value="Paper Collector">Paper Collector (प्रश्नपत्रिका संकलक)</option>
                <option value="Room Invigilator">Room Invigilator (दालन निरीक्षक)</option>
                <option value="Reliever">Reliever / Assistant (सहाय्यक)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.notes')}
              </label>
              <textarea
                rows={2}
                placeholder="Optional duty notes or assigned hall numbers..."
                value={dutyForm.notes}
                onChange={(e) => setDutyForm({ ...dutyForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!dutyForm.faculty_id}
                className="px-4 py-2 bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition cursor-pointer"
              >
                {t('examinations.assignDuty')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: QR Tokens & Bucket QR Viewer */}
      <Modal
        isOpen={isQRModalOpen && selectedExam !== null}
        onClose={() => setIsQRModalOpen(false)}
        title={t('examinations.qrTokens')}
        subtitle={selectedExam ? `${selectedExam.title} (${selectedExam.exam_code})` : undefined}
        isDirty={newBucketLabel.trim() !== ''}
        maxWidth="xl"
      >
        {selectedExam && (
          <div className="space-y-4">
            {/* List of generated QR tokens */}
            <div className="space-y-4">
              {selectedExam.qr_tokens && selectedExam.qr_tokens.length > 0 ? (
                selectedExam.qr_tokens.map((token) => (
                  <div
                    key={token.id}
                    className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-col sm:flex-row items-center gap-4"
                  >
                    {/* Rendered Vector SVG */}
                    <div
                      className="w-36 h-36 bg-white p-2 rounded-lg border border-slate-300 shadow-xs shrink-0 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: token.qr_svg_content || '' }}
                    />

                    <div className="space-y-2 flex-1 w-full text-center sm:text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">
                          {token.bucket_label || token.bucket_identifier || 'Main Question Paper Bucket'}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                          Active Token
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 font-mono break-all bg-white p-2 rounded border border-slate-200 select-all">
                        {token.token}
                      </div>

                      <p className="text-xs text-slate-400">
                        Scan from Faculty Portal upon exam paper bucket pickup.
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handlePrintToken(token)}
                          className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Print Label</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadSVG(token)}
                          className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download SVG</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                  <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No QR bucket tokens found for this examination session.</p>
                  <p className="text-slate-400 mt-1">Generate an authorized bucket token below for invigilator collection.</p>
                </div>
              )}

              {/* Generate Additional Bucket Token */}
              <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-lg flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New Bucket Label (e.g. Science Lab Bucket B-02)"
                  value={newBucketLabel}
                  onChange={(e) => setNewBucketLabel(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleGenerateQR}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 whitespace-nowrap cursor-pointer"
                >
                  {t('examinations.generateQR')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsQRModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* MODAL 4: Administrative Correction */}
      <Modal
        isOpen={isCorrectionModalOpen && selectedCheckin !== null}
        onClose={() => setIsCorrectionModalOpen(false)}
        title={t('examinations.correctCheckIn')}
        subtitle={selectedCheckin ? `Check-In #${selectedCheckin.id}` : undefined}
        isDirty={correctionForm.reason.trim() !== ''}
        maxWidth="md"
      >
        {selectedCheckin && (
          <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Status
              </label>
              <select
                value={correctionForm.status}
                onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="excused">Officially Excused (अधिकृतपणे माफ)</option>
                <option value="corrected">Corrected / Rectified (दुरुस्त)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.correctionReason')} *
              </label>
              <textarea
                required
                rows={3}
                placeholder="State valid reason: approved medical leave, scanner failure, or verified schedule adjustment..."
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!correctionForm.reason.trim()}
                className="px-4 py-2 bg-brand-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition cursor-pointer"
              >
                {t('examinations.saveCorrection')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 5: Incident Review */}
      <Modal
        isOpen={isIncidentReviewModalOpen && selectedIncident !== null}
        onClose={() => setIsIncidentReviewModalOpen(false)}
        title={t('examinations.reviewIncident')}
        subtitle={selectedIncident ? `Incident Report #${selectedIncident.id}` : undefined}
        isDirty={reviewForm.remarks.trim() !== ''}
        maxWidth="md"
      >
        {selectedIncident && (
          <form onSubmit={handleIncidentReviewSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Management Status
              </label>
              <select
                value={reviewForm.status}
                onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="resolved">Resolved / Counseling Completed (निकाली काढले)</option>
                <option value="reviewed">Reviewed (पुनरावलोकन केले)</option>
                <option value="dismissed">Dismissed / No Action Needed (रद्द केले)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('examinations.managementRemarks')} *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Record formal notes: discussion in staff meeting, adjusted timetable, or counseling outcome..."
                value={reviewForm.remarks}
                onChange={(e) => setReviewForm({ ...reviewForm, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsIncidentReviewModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!reviewForm.remarks.trim()}
                className="px-4 py-2 bg-slate-900 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 6: Edit Examination */}
      <Modal
        isOpen={isEditModalOpen && selectedExam !== null}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Examination Session"
        subtitle={selectedExam ? selectedExam.exam_code : undefined}
        isDirty={editExamData.title !== (selectedExam?.title || '') || editExamData.exam_date !== (selectedExam?.exam_date || '') || editExamData.location !== (selectedExam?.location || '')}
        maxWidth="lg"
      >
        {selectedExam && (
          <form onSubmit={handleEditExamSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Examination Title *
              </label>
              <input
                type="text"
                required
                value={editExamData.title}
                onChange={(e) => setEditExamData({ ...editExamData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Exam Date *
                </label>
                <input
                  type="date"
                  required
                  value={editExamData.exam_date}
                  onChange={(e) => setEditExamData({ ...editExamData, exam_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hall / Location *
                </label>
                <input
                  type="text"
                  required
                  value={editExamData.location}
                  onChange={(e) => setEditExamData({ ...editExamData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reporting Time *
                </label>
                <input
                  type="time"
                  required
                  value={editExamData.reporting_time}
                  onChange={(e) => setEditExamData({ ...editExamData, reporting_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deadline *
                </label>
                <input
                  type="time"
                  required
                  value={editExamData.collection_deadline}
                  onChange={(e) => setEditExamData({ ...editExamData, collection_deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grace (Mins) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  required
                  value={editExamData.grace_period_minutes}
                  onChange={(e) => setEditExamData({ ...editExamData, grace_period_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instructions / Notes
              </label>
              <textarea
                rows={2}
                value={editExamData.instructions || ''}
                onChange={(e) => setEditExamData({ ...editExamData, instructions: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 7: Cancel Examination */}
      <Modal
        isOpen={isCancelModalOpen && selectedExam !== null}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Examination Session"
        subtitle={selectedExam ? `${selectedExam.title} (${selectedExam.exam_code})` : undefined}
        isDirty={cancelReason.trim() !== ''}
        maxWidth="md"
      >
        {selectedExam && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
              <strong>Notice:</strong> Cancelling an examination marks it as cancelled and blocks future duty check-ins. All existing check-in logs, punctuality records, and incident reports remain intact for institutional audit history.
            </div>

            <form onSubmit={handleCancelExamSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State official reason (e.g., Unforeseen holiday, university timetable revision, weather disruption)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!cancelReason.trim()}
                  className="px-4 py-2 bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition cursor-pointer"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* MODAL 8: Safe Delete Examination */}
      <Modal
        isOpen={isDeleteModalOpen && examToDelete !== null}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Examination Session"
        subtitle={examToDelete ? `${examToDelete.title} (${examToDelete.exam_code})` : undefined}
        isDirty={false}
        maxWidth="md"
      >
        {examToDelete && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 leading-relaxed">
              <strong>Official Audit Protection:</strong> An examination session can ONLY be permanently deleted if no faculty check-ins or incident reports have been recorded. If attendance records exist, the server will block deletion to prevent data tampering. Use <em>Cancel Examination</em> instead.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteExamSubmit}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition cursor-pointer"
              >
                Delete Safely
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 9: View Details Modal */}
      <Modal
        isOpen={isDetailModalOpen && selectedExam !== null}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedExam ? selectedExam.title : 'Examination Details'}
        subtitle={selectedExam ? `${selectedExam.exam_code} • Status: ${selectedExam.status}` : undefined}
        isDirty={false}
        maxWidth="2xl"
      >
        {selectedExam && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Date</span>
                <span className="font-semibold text-slate-800">{selectedExam.exam_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Reporting</span>
                <span className="font-semibold text-slate-800">{selectedExam.reporting_time}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Deadline</span>
                <span className="font-semibold text-slate-800">{selectedExam.collection_deadline}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Grace Period</span>
                <span className="font-semibold text-slate-800">+{selectedExam.grace_period_minutes} mins</span>
              </div>
            </div>

            <div className="text-xs text-slate-600">
              <span className="text-slate-400 block mb-0.5">Hall / Location</span>
              <span className="font-medium text-slate-800">{selectedExam.location}</span>
            </div>

            {selectedExam.instructions && (
              <div className="text-xs text-slate-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <span className="text-blue-700 font-semibold block mb-1">Instructions:</span>
                <p className="italic text-slate-700">"{selectedExam.instructions}"</p>
              </div>
            )}

            {/* Assigned Faculty */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Assigned Faculty Duties ({selectedExam.duties?.length || 0})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedExam.duties && selectedExam.duties.length > 0 ? (
                  selectedExam.duties.map((duty) => (
                    <div key={duty.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{duty.faculty?.name || `Faculty #${duty.faculty_id}`}</span>
                        <span className="text-slate-500 ml-2">({duty.role_title})</span>
                        {duty.notes && <p className="text-slate-400 text-2xs mt-0.5">{duty.notes}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        duty.status === 'checked_in_ontime'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : duty.status === 'checked_in_late'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : duty.status === 'excused'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {duty.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No faculty members assigned yet.</p>
                )}
              </div>
            </div>

            {/* QR Tokens */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Authorized QR Bucket Tokens ({selectedExam.qr_tokens?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selectedExam.qr_tokens && selectedExam.qr_tokens.length > 0 ? (
                  selectedExam.qr_tokens.map((token) => (
                    <div key={token.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {token.bucket_label || token.bucket_identifier || 'Main Bucket'}
                      </span>
                      <span className="font-mono text-2xs text-slate-400 truncate max-w-xs">{token.token}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No QR tokens generated yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
