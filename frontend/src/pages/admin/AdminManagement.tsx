import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { User, AdminCreatePayload, AdminUpdatePayload, AdminAuditItem } from '../../types/auth';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/Modal';
import {
  ShieldCheck,
  UserPlus,
  Crown,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Edit2,
  Power
} from 'lucide-react';

export const AdminManagement: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [admins, setAdmins] = useState<User[]>([]);
  const [history, setHistory] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'admins' | 'history'>('admins');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    title: string;
    message: string;
    confirmAction: () => Promise<void>;
  } | null>(null);

  // Form states
  const initialAddForm: AdminCreatePayload = {
    name: '',
    username: '',
    email: '',
    password: '',
    designation: 'Trustee',
    phone: '',
    permissions: ['exam_management', 'notice_management', 'reports_access'],
  };
  const [formData, setFormData] = useState<AdminCreatePayload>(initialAddForm);

  const [editFormData, setEditFormData] = useState<AdminUpdatePayload>({
    name: '',
    email: '',
    designation: '',
    phone: '',
    permissions: [],
  });

  const [transferData, setTransferData] = useState({
    targetUserId: 0,
    confirmationPhrase: '',
    reason: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const permissionOptions = [
    { id: 'full_admin', label: t('adminManagement.perm_full_admin'), desc: t('adminManagement.perm_full_admin_desc') },
    { id: 'manage_admins', label: t('adminManagement.perm_manage_admins'), desc: t('adminManagement.perm_manage_admins_desc') },
    { id: 'exam_management', label: t('adminManagement.perm_exam_management'), desc: t('adminManagement.perm_exam_management_desc') },
    { id: 'notice_management', label: t('adminManagement.perm_notice_management'), desc: t('adminManagement.perm_notice_management_desc') },
    { id: 'reports_access', label: t('adminManagement.perm_reports_access'), desc: t('adminManagement.perm_reports_access_desc') },
    { id: 'settings_management', label: t('adminManagement.perm_settings_management'), desc: t('adminManagement.perm_settings_management_desc') },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [adminsData, historyData] = await Promise.all([
        api.admins.getAdmins(),
        api.admins.getHistory(),
      ]);
      setAdmins(adminsData);
      setHistory(historyData);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTogglePermission = (permId: string, isEdit: boolean = false) => {
    if (isEdit) {
      const current = editFormData.permissions || [];
      const updated = current.includes(permId)
        ? current.filter((p) => p !== permId)
        : [...current, permId];
      setEditFormData({ ...editFormData, permissions: updated });
    } else {
      const current = formData.permissions;
      const updated = current.includes(permId)
        ? current.filter((p) => p !== permId)
        : [...current, permId];
      setFormData({ ...formData, permissions: updated });
    }
  };

  const isAddFormDirty =
    formData.name !== '' ||
    formData.username !== '' ||
    formData.email !== '' ||
    formData.password !== '';

  const isEditFormDirty =
    showEditModal !== null &&
    (editFormData.name !== showEditModal.name ||
      editFormData.email !== showEditModal.email ||
      editFormData.designation !== (showEditModal.designation || ''));

  const isTransferDirty =
    transferData.targetUserId !== 0 ||
    transferData.reason !== '' ||
    transferData.confirmationPhrase !== '';

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    setShowConfirmModal({
      title: t('adminManagement.addAdmin'),
      message: `${t('common.confirm')}? ${formData.username} (${formData.name})`,
      confirmAction: async () => {
        try {
          setSubmitting(true);
          setError(null);
          await api.admins.createAdmin(formData);
          setShowAddModal(false);
          setFormData(initialAddForm);
          setSuccessMsg(t('common.success'));
          setTimeout(() => setSuccessMsg(null), 4000);
          fetchData();
        } catch (err: any) {
          setError(err.message || 'Failed to create administrator');
        } finally {
          setSubmitting(false);
          setShowConfirmModal(null);
        }
      },
    });
  };

  const handleEditAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;

    try {
      setSubmitting(true);
      setError(null);
      await api.admins.updateAdmin(showEditModal.id, editFormData);
      setShowEditModal(null);
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to update administrator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = (admin: User) => {
    const actionLabel = admin.is_active ? t('adminManagement.deactivateAdmin') : t('adminManagement.activateAdmin');
    setShowConfirmModal({
      title: actionLabel,
      message: `${t('common.confirm')}: ${admin.username} (${admin.name})?`,
      confirmAction: async () => {
        try {
          setError(null);
          if (admin.is_active) {
            await api.admins.deactivateAdmin(admin.id);
          } else {
            await api.admins.activateAdmin(admin.id);
          }
          setSuccessMsg(t('common.success'));
          setTimeout(() => setSuccessMsg(null), 4000);
          fetchData();
        } catch (err: any) {
          setError(err.message || `Failed to update status`);
        } finally {
          setShowConfirmModal(null);
        }
      },
    });
  };

  const handleTransferPrincipalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferData.confirmationPhrase.trim() !== 'TRANSFER_PRINCIPAL') {
      setError("Please type exact confirmation phrase 'TRANSFER_PRINCIPAL'.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.admins.transferPrincipal({
        new_principal_user_id: transferData.targetUserId,
        confirmation_phrase: transferData.confirmationPhrase.trim(),
        reason: transferData.reason.trim(),
      });
      setShowTransferModal(false);
      setTransferData({ targetUserId: 0, confirmationPhrase: '', reason: '' });
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to transfer Principal designation');
    } finally {
      setSubmitting(false);
    }
  };

  const canManageAdmins =
    currentUser?.is_principal ||
    (currentUser?.permissions && (currentUser.permissions.includes('full_admin') || currentUser.permissions.includes('manage_admins')));

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-700 border border-amber-200/60">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t('adminManagement.title')}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {t('adminManagement.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {canManageAdmins && (
          <div className="flex flex-wrap items-center gap-2.5">
            {currentUser?.is_principal && (
              <button
                type="button"
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-700" />
                <span>{t('adminManagement.transferPrincipal')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setFormData(initialAddForm);
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('adminManagement.addAdmin')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'admins'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          {t('adminManagement.adminAccounts')} ({admins.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          {t('adminManagement.auditTrail')} ({history.length})
        </button>
      </div>

      {/* Tab 1: Admins Cards Grid */}
      {activeTab === 'admins' && (
        <div>
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              {t('common.loading')}
            </div>
          ) : admins.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              {t('common.loading')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {admins.map((adm) => {
                const isCurrent = currentUser?.id === adm.id;
                const isPrincipal = adm.is_principal;
                const permissionsList = adm.permissions || [];

                return (
                  <div
                    key={adm.id}
                    className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between shadow-xs ${
                      isPrincipal
                        ? 'border-amber-300 ring-1 ring-amber-200 bg-gradient-to-b from-amber-50/20 to-white'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isPrincipal ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Crown className="w-3.5 h-3.5 text-amber-700" />
                              {t('adminManagement.designatedPrincipal')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {adm.designation || 'Trustee'}
                            </span>
                          )}

                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-100 text-brand-800">
                              {t('adminManagement.youAccount')}
                            </span>
                          )}
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                            adm.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {adm.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      </div>

                      {/* Name & Username */}
                      <h3 className="text-base font-bold text-slate-900 leading-tight">
                        {adm.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        @{adm.username}
                      </p>

                      {/* Contact Info */}
                      <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{adm.email}</span>
                        </div>
                        {adm.phone && (
                          <div className="flex items-center gap-2 truncate">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{adm.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Permissions List */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          {t('adminManagement.assignedPermissions')}:
                        </div>
                        {isPrincipal || permissionsList.includes('full_admin') ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200">
                            ★ {t('adminManagement.fullAdmin')}
                          </div>
                        ) : permissionsList.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {permissionsList.map((perm) => (
                              <span
                                key={perm}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-2xs font-semibold"
                              >
                                {t(`adminManagement.perm_${perm}`)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {canManageAdmins && (
                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEditModal(adm);
                            setEditFormData({
                              name: adm.name,
                              email: adm.email,
                              designation: adm.designation || '',
                              phone: adm.phone || '',
                              permissions: adm.permissions || [],
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{t('adminManagement.editAdmin')}</span>
                        </button>

                        {!isPrincipal && (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(adm)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                              adm.is_active
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={adm.is_active ? t('adminManagement.deactivateAdmin') : t('adminManagement.activateAdmin')}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Audit Trail Table */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">
              {t('adminManagement.auditTrail')}
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Total Records: {history.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t('adminManagement.timestamp')}</th>
                  <th className="py-3 px-4">{t('adminManagement.action')}</th>
                  <th className="py-3 px-4">{t('adminManagement.actor')}</th>
                  <th className="py-3 px-4">{t('adminManagement.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No administrative audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-2xs">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-2xs">
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-800">
                        {item.user_name || 'System'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-2xs max-w-md truncate">
                        {typeof item.details === 'object' ? JSON.stringify(item.details) : item.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Admin */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('adminManagement.addAdmin')}
        isDirty={isAddFormDirty}
        maxWidth="xl"
      >
        <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('settings.fullName')} *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.username')} *
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.email')} *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.designation')} *
              </label>
              <input
                type="text"
                required
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
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
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              {t('adminManagement.assignedPermissions')}:
            </label>
            <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50 max-h-48 overflow-y-auto">
              {permissionOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(opt.id)}
                    onChange={() => handleTogglePermission(opt.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                    <div className="text-2xs text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('adminManagement.addAdmin')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Admin */}
      <Modal
        isOpen={showEditModal !== null}
        onClose={() => setShowEditModal(null)}
        title={showEditModal ? `${t('adminManagement.editAdmin')}: ${showEditModal.username}` : ''}
        isDirty={isEditFormDirty}
        maxWidth="xl"
      >
        <form onSubmit={handleEditAdminSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('settings.fullName')}
            </label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.email')}
              </label>
              <input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('settings.designation')}
              </label>
              <input
                type="text"
                value={editFormData.designation}
                onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>

          {showEditModal && !showEditModal.is_principal && (
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                {t('adminManagement.assignedPermissions')}:
              </label>
              <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50 max-h-48 overflow-y-auto">
                {permissionOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={(editFormData.permissions || []).includes(opt.id)}
                      onChange={() => handleTogglePermission(opt.id, true)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                      <div className="text-2xs text-slate-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditModal(null)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('settings.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Principal Transfer */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title={t('adminManagement.transferPrincipal')}
        isDirty={isTransferDirty}
        maxWidth="lg"
      >
        <form onSubmit={handleTransferPrincipalSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select New Principal Account *
            </label>
            <select
              required
              value={transferData.targetUserId}
              onChange={(e) => setTransferData({ ...transferData, targetUserId: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value={0}>-- Select Administrator --</option>
              {admins
                .filter((a) => !a.is_principal && a.is_active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (@{a.username}) - {a.designation}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Transfer *
            </label>
            <textarea
              required
              rows={2}
              value={transferData.reason}
              onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirmation Phrase: <span className="font-mono text-red-600 font-bold">TRANSFER_PRINCIPAL</span> *
            </label>
            <input
              type="text"
              required
              value={transferData.confirmationPhrase}
              onChange={(e) => setTransferData({ ...transferData, confirmationPhrase: e.target.value })}
              placeholder="TRANSFER_PRINCIPAL"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowTransferModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? t('common.loading') : t('adminManagement.transferPrincipal')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowConfirmModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {showConfirmModal.title}
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {showConfirmModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={showConfirmModal.confirmAction}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
