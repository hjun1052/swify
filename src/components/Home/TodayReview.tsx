import React, { useEffect, useState } from 'react';
import styles from './TodayReview.module.css';

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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/history');
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || '기록을 불러오지 못했어요.');
      }
      setData(payload);
      const reflection = payload.reflection;
      if (reflection) {
        setReflectionId(reflection.id);
        setQuestion(reflection.question);
        setAnswer(reflection.answer || '');
        setStatus(reflection.answer ? '오늘의 회고 답변이 저장되어 있어요.' : null);
      } else {
        setReflectionId(null);
        setQuestion(null);
        setAnswer('');
        setStatus(null);
      }
    } catch (err) {
      console.error('History fetch failed', err);
      const message = err instanceof Error ? err.message : '기록을 불러오지 못했어요.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startReflection = async () => {
    if (!data || data.entries.length < MIN_ENTRIES_FOR_UI) return;
    setQuestionLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/api/history/reflection', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || '질문을 만들지 못했어요.');
      }
      setQuestion(payload.reflection.question);
      setReflectionId(payload.reflection.id);
      setAnswer('');
      setIsPanelOpen(true);
      setStatus('질문이 준비됐어요. 솔직하게 답해볼까요?');
    } catch (err) {
      console.error('Reflection start failed', err);
      const message = err instanceof Error ? err.message : '질문을 만들지 못했어요.';
      setError(message);
    } finally {
      setQuestionLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!reflectionId || !answer.trim()) {
      setError('한 줄이라도 당신의 생각을 남겨주세요.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/history/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reflectionId, answer }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || '답변을 저장하지 못했어요.');
      }
      setStatus('오늘의 회고가 보관함에 저장됐어요.');
      await fetchSummary();
    } catch (err) {
      console.error('Reflection submit failed', err);
      const message = err instanceof Error ? err.message : '답변을 저장하지 못했어요.';
      setError(message);
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
    ? '작성한 답을 이어서 볼까요?'
    : '한 줄 회고 남기기';

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
          <span className={styles.inlineTitle}>오늘 인사이트 정리하기</span>
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

      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {isPanelOpen && hasEnoughEntries && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelLabel}>오늘 본 영상</p>
            <button
              className={styles.refreshBtn}
              onClick={fetchSummary}
              disabled={loading}
            >
              새로고침
            </button>
          </div>
          <ul className={styles.titleList}>
            {titles.map((title, idx) => (
              <li key={`${title}-${idx}`}>{title}</li>
            ))}
          </ul>

          {question && (
            <div className={styles.questionBox}>
              <p className={styles.panelLabel}>AI가 건네는 질문</p>
              <blockquote>{question}</blockquote>
              <textarea
                placeholder="어떤 생각이 들었나요?"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!data?.reflection?.answer}
              />
              {!data?.reflection?.answer && (
                <button className={styles.primaryBtn} onClick={submitAnswer}>
                  보관함에 저장
                </button>
              )}
              {data?.reflection?.answer && (
                <p className={styles.helperText}>오늘 답변을 이미 저장했어요.</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
