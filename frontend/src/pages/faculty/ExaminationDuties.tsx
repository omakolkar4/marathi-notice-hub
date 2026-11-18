import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import {
  ExaminationDuty,
  FacultyCheckInRecord,
  FacultyPunctualitySummary,
} from '../../types/examination';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Camera,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Info,
  Check,
  X,
} from 'lucide-react';

export const ExaminationDuties: React.FC = () => {
  const { t } = useTranslation();

  const [duties, setDuties] = useState<ExaminationDuty[]>([]);
  const [punctuality, setPunctuality] = useState<FacultyPunctualitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState<ExaminationDuty | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FacultyCheckInRecord | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Video element for camera scanning
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dutiesData, warningsData] = await Promise.all([
        api.examinations.getMyDuties(),
        api.examinations.getMyWarnings(),
      ]);
      setDuties(dutiesData);
      setPunctuality(warningsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load examination duties.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } else {
        setCameraError('Webcam access not supported in this browser environment. Please use token input below.');
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. You can enter the QR token manually.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleOpenScanner = (duty: ExaminationDuty) => {
    setSelectedDuty(duty);
    setScanResult(null);
    setManualToken('');
    setIsScannerOpen(true);
    startCamera();
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsScannerOpen(false);
    setSelectedDuty(null);
  };

  const handleCheckInSubmit = async (tokenString: string) => {
    const cleanToken = tokenString.trim();
    if (!cleanToken) return;

    setIsScanning(true);
    setError(null);
    try {
      const result = await api.examinations.scanCheckIn(cleanToken);
      setScanResult(result);
      stopCamera();
      fetchData(); // refresh duties and warning counters
    } catch (err: any) {
      setError(err.message || 'QR Check-in verification failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const activeWarningsCount = punctuality?.active_warning_count || 0;
  const incidentsCount = punctuality?.total_incidents || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{t('examinations.facultyTitle')}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Exam Punctuality Tracking
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">{t('examinations.facultySubtitle')}</p>
        </div>

        <button
          onClick={fetchData}
          title={t('common.refresh')}
          className="p-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Faculty Punctuality & Strike Meter Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-600" />
              <span>Personal Punctuality Standing</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict server-verified timestamps track arrival for exam paper bucket collection.
            </p>
          </div>

          {/* Strike Indicators */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-600">Late Strikes:</span>
            <div className="flex items-center gap-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  activeWarningsCount >= 1 ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-slate-300'
                }`}
                title="Strike 1 (Warning 1)"
              />
              <span
                className={`w-3 h-3 rounded-full ${
                  activeWarningsCount >= 2 ? 'bg-amber-600 ring-2 ring-amber-200' : 'bg-slate-300'
                }`}
                title="Strike 2 (Warning 2)"
              />
              <span
                className={`w-3 h-3 rounded-full ${
                  incidentsCount >= 1 ? 'bg-red-600 ring-2 ring-red-200 animate-pulse' : 'bg-slate-300'
                }`}
                title="Strike 3 (Incident Report)"
              />
            </div>
            <span className="text-xs font-bold text-slate-800 ml-1">
              {activeWarningsCount} / 3 Strikes
            </span>
          </div>
        </div>

        {/* Status descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 text-xs">
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
            <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>On-Time Arrival</span>
            </div>
            <p className="text-emerald-700 mt-1">
              Check in before reporting deadline + grace period. No warning issued.
            </p>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
            <div className="font-semibold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Strike 1 & 2: Warnings</span>
            </div>
            <p className="text-amber-700 mt-1">
              Two formal late arrival warnings recorded on your profile.
            </p>
          </div>

          <div className="p-3 bg-red-50/70 border border-red-100 rounded-lg">
            <div className="font-semibold text-red-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>Strike 3: Incident Report</span>
            </div>
            <p className="text-red-700 mt-1">
              Automated report generated for Principal & committee review.
            </p>
          </div>
        </div>
      </div>

      {/* Assigned Duties List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-600" />
          <span>My Assigned Examination Duties ({duties.length})</span>
        </h2>

        {duties.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">{t('examinations.noDuties')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {duties.map((duty) => (
              <div
                key={duty.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                        {duty.role_title}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">
                        Examination Duty #{duty.id}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        duty.status === 'checked_in_ontime'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : duty.status === 'checked_in_late'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : duty.status === 'excused'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {duty.status === 'checked_in_ontime' && 'Checked In (On-Time)'}
                      {duty.status === 'checked_in_late' && 'Checked In (Late)'}
                      {duty.status === 'excused' && 'Officially Excused'}
                      {duty.status === 'assigned' && 'Check-In Pending'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Exam ID: <strong>#{duty.examination_id}</strong></span>
                    </div>
                    {duty.notes && (
                      <div className="flex items-start gap-1.5 mt-1 pt-1 border-t border-slate-200/60">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="italic">{duty.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scan Action */}
                <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Scan bucket QR at examination control room.
                  </span>

                  {duty.status === 'assigned' ? (
                    <button
                      onClick={() => handleOpenScanner(duty)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition shadow-xs"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Scan Collection QR</span>
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Attendance Recorded</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanner & Token Check-In Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900">{t('examinations.scanDutyQR')}</h3>
              </div>
              <button
                onClick={handleCloseScanner}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            {/* Check-In Result Card (Shown after scan) */}
            {scanResult ? (
              <div
                className={`p-5 rounded-xl border space-y-3 ${
                  scanResult.is_late
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {scanResult.is_late ? (
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  )}
                  <div>
                    <h4
                      className={`text-base font-bold ${
                        scanResult.is_late ? 'text-amber-900' : 'text-emerald-900'
                      }`}
                    >
                      {scanResult.is_late
                        ? t('examinations.checkInLateWarning')
                        : t('examinations.checkInSuccess')}
                    </h4>
                    <p
                      className={`text-xs ${
                        scanResult.is_late ? 'text-amber-800' : 'text-emerald-800'
                      }`}
                    >
                      {scanResult.is_late
                        ? `Arrival recorded ${scanResult.minutes_late} minutes past the collection deadline.`
                        : t('examinations.checkInSuccessDetail')}
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 p-3 rounded-lg text-xs space-y-1 font-mono">
                  <div>
                    Server Timestamp:{' '}
                    <strong>{new Date(scanResult.scanned_at).toLocaleTimeString()}</strong>
                  </div>
                  <div>
                    Scheduled Reporting:{' '}
                    <strong>{new Date(scanResult.scheduled_reporting_time).toLocaleTimeString()}</strong>
                  </div>
                  <div>
                    Check-In ID: <strong>#{scanResult.id}</strong>
                  </div>
                </div>

                {/* Strike / Incident Alert if Late */}
                {scanResult.warning && (
                  <div className="p-3 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-900">
                    <p className="font-bold">
                      Formal Warning Issued: Warning {scanResult.warning.warning_level}
                    </p>
                    <p className="mt-0.5">{scanResult.warning.warning_reason}</p>
                  </div>
                )}

                {scanResult.incident_report && (
                  <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      <span>Incident Report Triggered (Strike 3)</span>
                    </p>
                    <p className="mt-0.5">{scanResult.incident_report.incident_summary}</p>
                    <p className="text-2xs text-red-700 italic mt-1">
                      Submitted for administrative review.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCloseScanner}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Scanner Interface */
              <div className="space-y-4">
                {/* Video Stream Container */}
                <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-brand-400/40 rounded-lg pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-brand-400 rounded-lg animate-pulse" />
                  </div>
                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-900/90 p-4 text-center flex flex-col items-center justify-center text-slate-300 text-xs">
                      <Camera className="w-8 h-8 mb-2 text-slate-500" />
                      <p>{cameraError}</p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-slate-500">
                  {t('examinations.scanPrompt')}
                </p>

                {/* Optical / Manual Token Input Fallback */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('examinations.manualTokenInput')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('examinations.tokenPlaceholder')}
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!manualToken.trim() || isScanning}
                      onClick={() => handleCheckInSubmit(manualToken)}
                      className="px-4 py-2 bg-brand-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition"
                    >
                      {isScanning ? 'Verifying...' : t('examinations.submitScan')}
                    </button>
                  </div>
                  <p className="text-2xs text-slate-400">
                    Server-side validation ensures only assigned faculty and valid timeframes are accepted.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
