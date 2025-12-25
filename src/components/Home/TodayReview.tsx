import React, { useEffect, useState } from 'react';
import styles from './TodayReview.module.css';
import { useSettings } from '@/lib/store';

interface CategorySummary {
  category: string;
  count: number;
}

interface ReflectionSummary {
  id: string;
  question: string;
  answer?: string | null;
  summaryPayload?: {
    categories?: CategorySummary[];
    titles?: string[];
  } | null;
}

interface HistoryResponse {
  entries: { id: string; title: string; category: string; watchedAt: string }[];
  categories: CategorySummary[];
  titles: string[];
  reflection: ReflectionSummary | null;
}

const MIN_ENTRIES_FOR_UI = 2;

export default function TodayReview() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [reflectionId, setReflectionId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [statusKey, setStatusKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const { t, settings } = useSettings();

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      const res = await fetch('/api/history');
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || t('today_history_fetch_error'));
      }
      setData(payload);
      const reflection = payload.reflection;
      if (reflection) {
        setReflectionId(reflection.id);
        setQuestion(reflection.question);
        setAnswer(reflection.answer || '');
        setStatusKey(reflection.answer ? 'today_status_answered' : null);
      } else {
        setReflectionId(null);
        setQuestion(null);
        setAnswer('');
        setStatusKey(null);
      }
    } catch (err) {
      console.error('History fetch failed', err);
      setErrorKey('today_history_fetch_error');
    } finally {
      setLoading(false);
    }
  };

  const startReflection = async (forceNew = false) => {
    if (!data || data.entries.length < MIN_ENTRIES_FOR_UI) return;
    setQuestionLoading(true);
    setErrorKey(null);
    setStatusKey(null);
    try {
      const res = await fetch('/api/history/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: settings.language, forceNew }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || t('today_question_error'));
      }
      setQuestion(payload.reflection.question);
      setReflectionId(payload.reflection.id);
      setAnswer('');
      setIsPanelOpen(true);
      setStatusKey('today_status_prompt_ready');
    } catch (err) {
      console.error('Reflection start failed', err);
      setErrorKey('today_question_error');
    } finally {
      setQuestionLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!reflectionId || !answer.trim()) {
      setErrorKey('today_answer_required');
      return;
    }
    setErrorKey(null);
    try {
      const res = await fetch('/api/history/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reflectionId, answer }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || t('today_answer_error'));
      }
      setStatusKey('today_status_saved');
      await fetchSummary();
    } catch (err) {
      console.error('Reflection submit failed', err);
      setErrorKey('today_answer_error');
    }
  };

  const categories = data?.categories ?? [];
  const titles = data?.titles ?? [];
  const entryCount = data?.entries?.length ?? 0;
  const hasEnoughEntries = entryCount >= MIN_ENTRIES_FOR_UI;

  if (loading || !hasEnoughEntries) {
    return null;
  }

  const inlineHint = question
    ? t('today_inline_continue')
    : t('today_inline_start');

  const handleInlineClick = () => {
    if (!hasEnoughEntries || loading) return;
    if (!question && !questionLoading) {
      startReflection();
      return;
    }
    setIsPanelOpen(prev => !prev);
  };

  return (
    <section className={styles.reviewCard}>
        <button
          className={styles.inlineButton}
          onClick={handleInlineClick}
          disabled={!hasEnoughEntries || loading || questionLoading}
        >
          <div className={styles.inlineTexts}>
            <span className={styles.inlineTitle}>{t('today_inline_title')}</span>
            <span className={styles.inlineHint}>{inlineHint}</span>
          </div>
          <span className={styles.inlineArrow}>→</span>
        </button>

      {categories.length > 0 && (
        <div className={styles.categoryList}>
          {categories.map((cat) => (
            <span key={cat.category} className={styles.categoryChip}>
              {cat.category} · {cat.count}
            </span>
          ))}
        </div>
      )}

      {statusKey && <p className={styles.status}>{t(statusKey)}</p>}
      {errorKey && <p className={styles.error}>{t(errorKey)}</p>}

      {isPanelOpen && hasEnoughEntries && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelLabel}>{t('today_watched_label')}</p>
            <div className={styles.refreshGroup}>
              <button
                className={styles.refreshBtn}
                onClick={() => startReflection(true)}
                disabled={questionLoading || loading}
              >
                {t('today_generate_question')}
              </button>
              <button
                className={styles.refreshIconBtn}
                onClick={fetchSummary}
                disabled={loading}
                aria-label={t('today_refresh_summary')}
              >
                ↻
              </button>
            </div>
          </div>
          <ul className={styles.titleList}>
            {titles.map((title, idx) => (
              <li key={`${title}-${idx}`}>{title}</li>
            ))}
          </ul>

          {question && (
            <div className={styles.questionBox}>
              <p className={styles.panelLabel}>{t('today_question_label')}</p>
              <blockquote>{question}</blockquote>
              <textarea
                placeholder={t('today_answer_placeholder')}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!data?.reflection?.answer}
              />
              {!data?.reflection?.answer && (
                <button className={styles.primaryBtn} onClick={submitAnswer}>
                  {t('today_save_to_library')}
                </button>
              )}
              {data?.reflection?.answer && (
                <p className={styles.helperText}>{t('today_already_answered')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
