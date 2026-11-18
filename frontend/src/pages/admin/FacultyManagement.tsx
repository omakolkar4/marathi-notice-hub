import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { User } from '../../types/auth';
import { Department } from '../../types/department';
import { Modal } from '../../components/Modal';
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Search,
  Building2,
  BookOpen,
  Edit2,
  Sparkles,
  ShieldAlert,
  Power
} from 'lucide-react';

export const FacultyManagement: React.FC = () => {
  const { t } = useTranslation();
  const [facultyList, setFacultyList] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settingUpDemo, setSettingUpDemo] = useState(false);

  const initialAddForm = {
    name: '',
    username: '',
    email: '',
    password: '',
    department_id: '' as string | number,
    subject: '',
    designation: 'Teacher',
    role: 'Faculty',
  };

  const [formData, setFormData] = useState(initialAddForm);

  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department_id: '' as string | number,
    subject: '',
    designation: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, deptsData] = await Promise.all([
        api.users.getUsers({ role: 'Faculty' }),
        api.departments.getDepartments(),
      ]);
      setFacultyList(usersData.filter((u) => u.role === 'Faculty'));
      setDepartments(deptsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isAddDirty =
    formData.name !== '' ||
    formData.username !== '' ||
    formData.email !== '' ||
    formData.password !== '';

  const isEditDirty =
    showEditModal !== null &&
    (editFormData.name !== showEditModal.name ||
      editFormData.email !== showEditModal.email ||
      editFormData.department_id !== (showEditModal.department_id || '') ||
      editFormData.subject !== (showEditModal.subject || '') ||
      editFormData.designation !== (showEditModal.designation || ''));

  const handleToggleActive = async (user: User) => {
    try {
      setError(null);
      if (user.is_active) {
        await api.users.deactivateUser(user.id);
      } else {
        await api.users.activateUser(user.id);
      }
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to change user status');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        ...formData,
        department_id: formData.department_id ? Number(formData.department_id) : null,
      };

      await api.users.createUser(payload as any);
      setSuccessMsg(t('common.success'));
      setShowAddModal(false);
      setFormData(initialAddForm);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to add faculty member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: editFormData.name,
        email: editFormData.email,
        department_id: editFormData.department_id ? Number(editFormData.department_id) : null,
        subject: editFormData.subject,
        designation: editFormData.designation,
      };

      await api.users.updateUser(showEditModal.id, payload as any);
      setSuccessMsg(t('common.success'));
      setShowEditModal(null);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update faculty member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupDemo = async () => {
    try {
      setSettingUpDemo(true);
      setError(null);
      const res = await api.departments.setupDemoFaculty();
      setSuccessMsg(res.message || t('common.success'));
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to run department demo setup');
    } finally {
      setSettingUpDemo(false);
    }
  };

  const filteredFaculty = facultyList.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase()) ||
      member.username.toLowerCase().includes(search.toLowerCase()) ||
      (member.subject && member.subject.toLowerCase().includes(search.toLowerCase()));

    const matchesDept =
      selectedDept === 'all' || member.department_id === Number(selectedDept);

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            {t('faculty.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {facultyList.filter((u) => u.is_active).length} {t('common.active')} / {facultyList.length} {t('departments.memberCount')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSetupDemo}
            disabled={settingUpDemo}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs border border-purple-200 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>{settingUpDemo ? t('common.loading') : 'Verify Department Faculty'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormData(initialAddForm);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('faculty.addFaculty')}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('notices.searchPlaceholder')}`}
            className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-sm p-2 border border-slate-200 rounded-lg outline-none bg-white cursor-pointer"
          >
            <option value="all">-- {t('departments.title')} --</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {t('common.loading')}
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            {t('departments.noFaculty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">{t('faculty.name')}</th>
                  <th className="px-6 py-3.5">{t('faculty.department')}</th>
                  <th className="px-6 py-3.5">{t('faculty.subject')} / {t('faculty.designation')}</th>
                  <th className="px-6 py-3.5">{t('faculty.status')}</th>
                  <th className="px-6 py-3.5 text-right">{t('notices.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredFaculty.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-900">{member.name}</div>
                      <div className="text-2xs text-slate-400 font-mono">@{member.username} • {member.email}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      {member.department?.name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-2xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {member.department.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">{t('departments.noHead')}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="text-slate-900">{member.subject || '—'}</div>
                      <div className="text-2xs text-slate-500">{member.designation || 'Teacher'}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold ${
                          member.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {member.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEditModal(member);
                            setEditFormData({
                              name: member.name,
                              email: member.email,
                              department_id: member.department_id || '',
                              subject: member.subject || '',
                              designation: member.designation || '',
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member)}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                            member.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={member.is_active ? t('faculty.deactivateBtn') : t('faculty.activateBtn')}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Faculty */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('faculty.addFaculty')}
        isDirty={isAddDirty}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.name')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.username')} *
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.password')} *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.email')} *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.department')}
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white cursor-pointer"
              >
                <option value="">-- {t('departments.noHead')} --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.subject')}
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.designation')}
            </label>
            <input
              type="text"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('common.loading') : t('faculty.addFaculty')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Faculty */}
      <Modal
        isOpen={showEditModal !== null}
        onClose={() => setShowEditModal(null)}
        title={showEditModal ? `${t('faculty.title')}: ${showEditModal.username}` : ''}
        isDirty={isEditDirty}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.name')} *
            </label>
            <input
              type="text"
              required
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.email')} *
            </label>
            <input
              type="email"
              required
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.department')}
              </label>
              <select
                value={editFormData.department_id}
                onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white cursor-pointer"
              >
                <option value="">-- {t('departments.noHead')} --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('faculty.subject')}
              </label>
              <input
                type="text"
                value={editFormData.subject}
                onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('faculty.designation')}
            </label>
            <input
              type="text"
              value={editFormData.designation}
              onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t('common.loading') : t('settings.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
