import React from 'react';
import { useTranslation } from 'react-i18next';
import { NLPAnalysis } from '../types/notice';
import {
  Sparkles,
  AlertTriangle,
  Calendar,
  Clock,
  Target,
  Users,
  Info,
  Layers,
} from 'lucide-react';

export interface NLPPreviewBoxProps {
  nlpAnalysis?: NLPAnalysis | null;
  analysis?: NLPAnalysis | null;
  loading?: boolean;
  noticeLanguage?: string;
}

export const NLPPreviewBox: React.FC<NLPPreviewBoxProps> = ({
  nlpAnalysis,
  analysis,
  loading = false,
  noticeLanguage = 'mr',
}) => {
  const { t } = useTranslation();
  const effectiveAnalysis = nlpAnalysis || analysis;

  if (loading) {
    return (
      <div className="bg-brand-50/60 rounded-xl p-8 border border-brand-200 text-center space-y-3">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-brand-600 mx-auto"></div>
        <div className="text-xs font-semibold text-brand-800">
          Analyzing notice text with Marathi NLP model...
        </div>
      </div>
    );
  }

  if (!effectiveAnalysis) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 border border-dashed border-slate-300 text-center text-xs text-slate-500">
        Click "{t('notices.previewNLP')}" to generate category prediction, entity extraction, and recipient recommendations.
      </div>
    );
  }

  const isNonMarathi = noticeLanguage !== 'mr';

  return (
    <div className="bg-gradient-to-br from-brand-50/70 to-indigo-50/50 rounded-xl p-5 border border-brand-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-200/80 pb-3">
        <div className="flex items-center gap-2 text-brand-900 font-bold text-sm">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <span>{t('nlp.analysisHeading')}</span>
        </div>
        <span className="text-xs bg-white text-brand-700 font-semibold px-2.5 py-1 rounded-full border border-brand-200 shadow-2xs">
          v{effectiveAnalysis.model_version || '0.1.0-tfidf'}
        </span>
      </div>

      {/* Multilingual Notice Disclaimer if non-Marathi */}
      {isNonMarathi && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{t('nlp.multilingualNoticeInfo')}</p>
          </div>
        </div>
      )}

      {/* Predicted Category & Confidence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">
            {t('nlp.predictedCategory')}
          </span>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 bg-brand-50 text-brand-800 px-2 py-0.5 rounded">
              {t(`categories.${effectiveAnalysis.predicted_category}`, effectiveAnalysis.predicted_category)}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {(effectiveAnalysis.confidence * 100).toFixed(1)}% {t('nlp.confidenceScore')}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${
                effectiveAnalysis.confidence > 0.4 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(effectiveAnalysis.confidence * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Suggested Recipients Count */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">
            {t('nlp.suggestedRecipients')}
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {effectiveAnalysis.suggested_recipients && effectiveAnalysis.suggested_recipients.length > 0 ? (
              effectiveAnalysis.suggested_recipients.map((recip, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                    recip.recipient_type === 'UNKNOWN'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  {recip.department_or_subject || recip.recipient_type}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">None detected</span>
            )}
          </div>
        </div>
      </div>

      {/* Extracted Entities */}
      {effectiveAnalysis.extracted_entities && (
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2">
          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-brand-600" />
            {t('nlp.entitiesDetected')}
          </span>

          <div className="flex flex-wrap gap-2 text-xs">
            {/* Dates */}
            {effectiveAnalysis.extracted_entities.dates?.map((d, i) => (
              <span key={`date-${i}`} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                <Calendar className="w-3 h-3 text-blue-600" />
                {d.formatted || d.raw_text}
              </span>
            ))}

            {/* Times */}
            {effectiveAnalysis.extracted_entities.times?.map((tm, i) => (
              <span key={`time-${i}`} className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                <Clock className="w-3 h-3 text-purple-600" />
                {tm.time}
              </span>
            ))}

            {/* Deadlines */}
            {effectiveAnalysis.extracted_entities.deadlines?.map((dl, i) => (
              <span key={`dl-${i}`} className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200 font-medium">
                <Target className="w-3 h-3 text-rose-600" />
                {dl.raw_phrase}
              </span>
            ))}

            {/* Subjects */}
            {effectiveAnalysis.extracted_entities.subjects?.map((sub, i) => (
              <span key={`sub-${i}`} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {sub}
              </span>
            ))}

            {/* Departments */}
            {effectiveAnalysis.extracted_entities.departments?.map((dept, i) => (
              <span key={`dept-${i}`} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {dept}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Review Required Warning Banner */}
      {effectiveAnalysis.review_required && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">{t('nlp.reviewRequired')}</span>
            {effectiveAnalysis.review_reasons?.map((reason, idx) => (
              <p key={idx} className="text-amber-800">
                • {reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recipient Match Explanation */}
      {effectiveAnalysis.recipient_explanation && (
        <p className="text-xs text-slate-500 italic bg-white/60 p-2 rounded border border-brand-100">
          <span className="font-semibold text-slate-600">{t('nlp.explanation')}: </span>
          {effectiveAnalysis.recipient_explanation}
        </p>
      )}
    </div>
  );
};
