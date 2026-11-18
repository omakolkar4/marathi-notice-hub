import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { Department, DepartmentDetail } from '../../types/department';
import { User } from '../../types/auth';
import { Modal } from '../../components/Modal';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Users,
  Award,
  Bell,
  Clock,
  UserCheck,
} from 'lucide-react';

export const DepartmentManagement: React.FC = () => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allFaculty, setAllFaculty] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add / Edit Department Modal
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [initialFormData, setInitialFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  // Department Details Modal
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deptDetails, setDeptDetails] = useState<DepartmentDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Assign Head State
  const [assigningHead, setAssigningHead] = useState(false);
  const [selectedHeadId, setSelectedHeadId] = useState<number | ''>('');

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const [deptData, facultyData] = await Promise.all([
        api.departments.getDepartments(),
        api.users.getUsers({ role: 'Faculty', is_active: true }),
      ]);
      setDepartments(deptData);
      setAllFaculty(facultyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleOpenAdd = () => {
    setEditingDept(null);
    const initial = { name: '', description: '' };
    setFormData(initial);
    setInitialFormData(initial);
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (dept: Department, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDept(dept);
    const initial = { name: dept.name, description: dept.description || '' };
    setFormData(initial);
    setInitialFormData(initial);
    setShowAddEditModal(true);
  };

  const isFormDirty =
    formData.name !== initialFormData.name ||
    formData.description !== initialFormData.description;

  const handleViewDetails = async (deptId: number) => {
    try {
      setSelectedDeptId(deptId);
      setLoadingDetails(true);
      const details = await api.departments.getDepartmentDetails(deptId);
      setDeptDetails(details);
      setSelectedHeadId(details.head_id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load department details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(t('departments.deleteConfirm'))) return;
    try {
      setError(null);
      await api.departments.deleteDepartment(id);
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 3000);
      if (selectedDeptId === id) {
        setSelectedDeptId(null);
        setDeptDetails(null);
      }
      fetchDepartments();
    } catch (err: any) {
      setError(err.message || 'Cannot delete department with assigned faculty');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (editingDept) {
        await api.departments.updateDepartment(editingDept.id, formData);
        setSuccessMsg(t('common.success'));
      } else {
        await api.departments.createDepartment(formData);
        setSuccessMsg(t('common.success'));
      }
      setShowAddEditModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchDepartments();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveHead = async () => {
    if (!deptDetails) return;
    try {
      setAssigningHead(true);
      setError(null);
      const headId = selectedHeadId === '' ? null : Number(selectedHeadId);
      await api.departments.assignDepartmentHead(deptDetails.id, headId);
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 3000);
      // Refresh current details and list
      const updatedDetails = await api.departments.getDepartmentDetails(deptDetails.id);
      setDeptDetails(updatedDetails);
      fetchDepartments();
    } catch (err: any) {
      setError(err.message || 'Failed to assign department head');
    } finally {
      setAssigningHead(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            {t('departments.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('departments.totalDepartments')}: {departments.length}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('departments.addDepartment')}
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* Department Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
          {t('common.loading')}
        </div>
      ) : departments.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
          {t('departments.noNotices')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              onClick={() => handleViewDetails(dept.id)}
              className="group bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-brand-400 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer relative"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2.5 rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                        {dept.name}
                      </h3>
                      <div className="text-2xs text-slate-400 font-mono">
                        ID: #{dept.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(dept, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      title={t('common.save')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(dept.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title={t('departments.deleteConfirm')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {dept.description || '—'}
                </p>

                {/* Department Head Indicator */}
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-slate-500">{t('departments.departmentHead')}:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {dept.head_name || t('departments.noHead')}
                  </span>
                </div>
              </div>

              {/* Counts footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                  <Users className="w-3.5 h-3.5 text-brand-600" />
                  {t('departments.memberCount')}:{' '}
                  <strong className="text-slate-900">{dept.faculty_count ?? 0}</strong>
                </span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-2xs">
                  {dept.active_faculty_count ?? 0} {t('departments.activeFaculty')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingDept ? t('departments.editDepartment') : t('departments.addDepartment')}
        isDirty={isFormDirty}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('departments.name')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('departments.description')}
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddEditModal(false)}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-slate-700 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Department Details Modal */}
      <Modal
        isOpen={selectedDeptId !== null}
        onClose={() => {
          setSelectedDeptId(null);
          setDeptDetails(null);
        }}
        title={
          deptDetails ? (
            <span className="flex items-center gap-2 text-slate-900">
              <Building2 className="w-5 h-5 text-brand-600" />
              {deptDetails.name}
            </span>
          ) : (
            t('departments.detailsTitle')
          )
        }
        subtitle={deptDetails?.description || undefined}
        maxWidth="3xl"
      >
        {loadingDetails || !deptDetails ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {t('common.loading')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-2xs text-slate-500 font-medium">
                  {t('departments.departmentHead')}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600 shrink-0" />
                  {deptDetails.head_name || t('departments.noHead')}
                </div>
              </div>
              <div className="p-3.5 bg-brand-50/50 rounded-xl border border-brand-100">
                <div className="text-2xs text-brand-700 font-medium">
                  {t('departments.memberCount')}
                </div>
                <div className="text-base font-extrabold text-brand-900 mt-1">
                  {deptDetails.faculty_count} ({deptDetails.active_faculty_count} {t('common.active')})
                </div>
              </div>
              <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="text-2xs text-purple-700 font-medium">
                  {t('departments.recentNotices')}
                </div>
                <div className="text-base font-extrabold text-purple-900 mt-1">
                  {deptDetails.notices_count}
                </div>
              </div>
            </div>

            {/* Department Head Assignment Box */}
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <Award className="w-4 h-4 text-amber-600" />
                {t('departments.assignHead')}
              </h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={selectedHeadId}
                  onChange={(e) => setSelectedHeadId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="text-xs p-2.5 bg-white border border-slate-300 rounded-lg flex-1 outline-hidden"
                >
                  <option value="">-- {t('departments.noHead')} --</option>
                  {/* Prioritize faculty already in this department */}
                  <optgroup label={t('departments.facultyList')}>
                    {deptDetails.faculty.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.designation || f.subject || 'Faculty'})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('faculty.title')}>
                    {allFaculty
                      .filter((af) => !deptDetails.faculty.some((df) => df.id === af.id))
                      .map((af) => (
                        <option key={af.id} value={af.id}>
                          {af.name} ({af.designation || 'Faculty'})
                        </option>
                      ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={handleSaveHead}
                  disabled={assigningHead}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {assigningHead ? t('common.loading') : t('departments.saveHead')}
                </button>
              </div>
            </div>

            {/* Faculty Members Table */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-brand-600" />
                {t('departments.facultyList')} ({deptDetails.faculty.length})
              </h4>
              {deptDetails.faculty.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  {t('departments.noFaculty')}
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">{t('faculty.name')}</th>
                        <th className="py-2.5 px-3">{t('faculty.designation')}</th>
                        <th className="py-2.5 px-3">{t('faculty.subject')}</th>
                        <th className="py-2.5 px-3">{t('faculty.email')}</th>
                        <th className="py-2.5 px-3 text-right">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {deptDetails.faculty.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 flex items-center gap-1.5">
                            {f.id === deptDetails.head_id ? (
                              <span title={t('departments.departmentHead')} className="inline-flex">
                                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              </span>
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-900">{f.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{f.designation || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{f.subject || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-2xs">{f.email}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                                f.is_active
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {f.is_active ? t('common.active') : t('common.inactive')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Department Circulars / Notices */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-purple-600" />
                {t('departments.recentNotices')} ({deptDetails.recent_notices.length})
              </h4>
              {deptDetails.recent_notices.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  {t('departments.noNotices')}
                </div>
              ) : (
                <div className="space-y-2">
                  {deptDetails.recent_notices.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <div className="text-2xs text-slate-500 mt-0.5">
                          {n.category} • {n.creator_name || 'System'} • {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-2xs">
                        {n.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Department Activity */}
            {deptDetails.recent_activities.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-slate-500" />
                  {t('departments.recentActivity')}
                </h4>
                <div className="space-y-2">
                  {deptDetails.recent_activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-2xs text-brand-700 font-semibold">{act.action}</span>
                        <span className="text-slate-600 ml-2">by {act.user_name}</span>
                      </div>
                      <span className="text-2xs text-slate-400">
                        {act.created_at ? new Date(act.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
