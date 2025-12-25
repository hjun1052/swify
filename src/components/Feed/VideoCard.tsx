"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpCircle, Heart, MessageCircle, Play, Pause, Loader2, BookOpen, Brain } from 'lucide-react';
import { VideoShort } from '@/app/api/generate/route';
import styles from './VideoCard.module.css';
import CommentDrawer from './CommentDrawer';
import { QuizEvaluation, QuizQuestion } from '@/types/quiz';
import { useSettings } from '@/lib/store';

interface VideoCardProps {
  video: VideoShort;
  isActive: boolean;
}

export default function VideoCard({ video, isActive }: VideoCardProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0); // 0-100% of current slide
  const [assetTimedOut, setAssetTimedOut] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New state for hydration progress
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [showPauseFeedback, setShowPauseFeedback] = useState(false);
  const [prevIndex, setPrevIndex] = useState(currentSlideIndex);
  const [quizData, setQuizData] = useState<QuizQuestion[] | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<QuizEvaluation | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResponses, setQuizResponses] = useState<Record<string, { value: string; reasoning?: string }>>({});
  const hasLoggedWatch = useRef(false);
  const { t, settings } = useSettings();

  // Sync timeout reset with index changes (prevents cascading render warning)
  if (currentSlideIndex !== prevIndex) {
    setPrevIndex(currentSlideIndex);
    setAssetTimedOut(false);
  }

  const [slides, setSlides] = useState(video.slides);
  const currentSlide = slides[currentSlideIndex];

  const [isAssetLoading, setIsAssetLoading] = useState(isActive && (!currentSlide?.audioUrl || !currentSlide?.imageUrl || currentSlide.imageUrl.includes("placehold.co")));

  // Sync isSaved state on video change or initial mount
  useEffect(() => {
    fetch('/api/library')
      .then(res => res.json())
      .then((savedVideos: (VideoShort & { id: string })[]) => {
        setIsSaved(savedVideos.some(v => v.id === video.id));
      })
      .catch(err => console.error("Failed to fetch saved status", err));
  }, [video.id]);

  // Update loading state immediately when currentSlide changes
  useEffect(() => {
    const loading = isActive && !assetTimedOut && (!currentSlide?.audioUrl || !currentSlide?.imageUrl || currentSlide.imageUrl.includes("placehold.co"));
    setIsAssetLoading(loading);
  }, [isActive, currentSlideIndex, currentSlide, assetTimedOut]);

  useEffect(() => {
    if (!isActive || hasLoggedWatch.current) return;

    hasLoggedWatch.current = true;
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: video.id,
        title: video.title,
        category: video.category,
        style: video.style,
      }),
    }).catch((error) => {
      console.warn('Failed to log watch history', error);
    });
  }, [isActive, video.id, video.title, video.category, video.style]);

  const togglePause = (e: React.MouseEvent) => {
    // Don't pause if clicking buttons or input
    const target = e.target as HTMLElement;
    if (target.closest(`.${styles.actions}`) || target.closest(`.${styles.modifierWrapper}`)) {
      return;
    }

    setIsPaused(!isPaused);
    setShowPauseFeedback(true);
    setTimeout(() => setShowPauseFeedback(false), 400);
  };

  const hydrateAllSlides = async () => {
    const updatedSlides = [...slides];
    const hydrationPromises = updatedSlides.map(async (s, i) => {
      if (s.imageUrl && s.audioUrl && !s.imageUrl.includes("placehold.co")) return;

      try {
        const res = await fetch('/api/augment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: s.text,
            imageQuery: s.imageQuery,
            voice: video.voice,
            topic: video.title
          })
        });
        const data = await res.json();
        if (data.imageUrl || data.audioUrl) {
          updatedSlides[i] = {
            ...updatedSlides[i],
            imageUrl: data.imageUrl || updatedSlides[i].imageUrl,
            audioUrl: data.audioUrl || updatedSlides[i].audioUrl
          };
        }
      } catch (e) {
        console.error(`Failed to hydrate slide ${i}`, e);
      }
    });

    await Promise.all(hydrationPromises);
    setSlides(updatedSlides);
    return updatedSlides;
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent pause toggle

    if (isSaving) return;

    if (isSaved) {
      // Unsave immediate
      setIsSaved(false);
      try {
        await fetch(`/api/library?id=${video.id}`, { method: 'DELETE' });
      } catch (error) {
        console.error("Failed to delete save", error);
        setIsSaved(true);
      }
      return;
    }

    // Saving: Hydrate everything first for instant library playback
    setIsSaving(true);
    try {
      const hydratedSlides = await hydrateAllSlides();

      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...video, slides: hydratedSlides })
      });

      if (res.ok) {
        setIsSaved(true);
      }
    } catch (error) {
      console.error("Failed to save with hydration", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCommentOpen(!isCommentOpen);
    setIsSourceOpen(false); // Close source
    setIsQuizOpen(false);
    if (!isCommentOpen) setIsPaused(true);
  };

  const toggleSources = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSourceOpen(!isSourceOpen);
    setIsCommentOpen(false); // Close comments
    setIsQuizOpen(false);
  };

  const buildQuizPayload = () => ({
    id: video.id,
    title: video.title,
    topic: video.suggestedNextQuery || video.title,
    slides: video.slides.map(slide => ({
      id: slide.id,
      text: slide.text,
    })),
  });

  const fetchQuiz = async () => {
    setQuizLoading(true);
    setQuizError(null);
    setQuizFeedback(null);
    setQuizResponses({});
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video: buildQuizPayload(), language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('quiz_fetch_error'));
      }
      setQuizData(data.quiz);
    } catch (error) {
      console.error('Quiz fetch failed', error);
      const message =
        error instanceof Error ? error.message : t('quiz_fetch_error');
      setQuizError(message);
    } finally {
      setQuizLoading(false);
    }
  };

  const toggleQuiz = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextOpen = !isQuizOpen;
    setIsQuizOpen(nextOpen);
    setIsSourceOpen(false);
    setIsCommentOpen(false);
    if (nextOpen && !quizData) {
      fetchQuiz();
    }
  };

  const setQuizValue = (questionId: string, value: string) => {
    setQuizResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        value,
      },
    }));
  };

  const setQuizReasoning = (questionId: string, reasoning: string) => {
    setQuizResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        reasoning,
      },
    }));
  };

  const isQuizReady = quizData
    ? quizData.every((question) => {
        const response = quizResponses[question.id];
        if (!response || !response.value) return false;
        if (question.type === 'open') {
          return response.value.trim().length > 0;
        }
        return true;
      })
    : false;

  const submitQuiz = async () => {
    if (!quizData) return;
    if (!isQuizReady) {
      setQuizError(t('quiz_answer_required'));
      return;
    }

    setQuizSubmitting(true);
    setQuizError(null);

    try {
      const answers = quizData.map((question) => {
        const response = quizResponses[question.id];
        if (!response) {
          throw new Error(t('quiz_answer_required'));
        }

        if (question.type === 'multiple_choice' && question.options) {
          const selected = question.options.find(
            (option) => option.id === response.value
          );
          return {
            questionId: question.id,
            answer: selected
              ? `${selected.label}${
                  selected.description ? ` — ${selected.description}` : ''
                }`
              : response.value,
            reasoning: response.reasoning,
          };
        }

        return {
          questionId: question.id,
          answer: response.value,
        };
      });

      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: buildQuizPayload(),
          language: settings.language,
          quiz: quizData,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('quiz_feedback_error'));
      }
      setQuizFeedback(data.evaluation);
    } catch (error) {
      console.error('Quiz submission failed', error);
      const message =
        error instanceof Error ? error.message : t('quiz_feedback_error');
      setQuizError(message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const refreshQuiz = () => {
    setQuizData(null);
    setQuizFeedback(null);
    fetchQuiz();
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  // Progressive Hydration Logic
  const hydratingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Aggressive Preload Buffer: Load Current + 3 slides ahead
    const PRELOAD_BUFFER = 4;

    const hydrateSlide = async (index: number) => {
      // Bounds check
      if (index >= slides.length) return;

      const slide = slides[index];
      // Skip if already hydrated or currently hydrating
      if (!slide || (slide.audioUrl && slide.imageUrl !== "") || !slide.imageQuery || hydratingRef.current.has(index)) return;

      hydratingRef.current.add(index);

      try {
        // Fetch strictly in parallel (async) - don't await here for the loop
        fetch('/api/augment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: slide.text,
            imageQuery: slide.imageQuery,
            voice: video.voice, // Pass the assigned voice
            topic: video.title
          })
        }).then(res => res.json()).then(data => {
          if (data.imageUrl || data.audioUrl) {
            setSlides(prev => {
              const newSlides = [...prev];
              // Safety check if slide still exists
              if (!newSlides[index]) return prev;

              newSlides[index] = {
                ...newSlides[index],
                imageUrl: data.imageUrl || newSlides[index].imageUrl,
                audioUrl: data.audioUrl || newSlides[index].audioUrl
              };
              return newSlides;
            });
          }
        }).catch(err => console.error(`Hydration failed for slide ${index}`, err))
          .finally(() => hydratingRef.current.delete(index));

      } catch (error) {
        console.error("Hydration init failed", index, error);
        hydratingRef.current.delete(index);
      }
    };

    for (let i = 0; i < PRELOAD_BUFFER; i++) {
      hydrateSlide(currentSlideIndex + i);
    }
  }, [currentSlideIndex, video, slides]);

  // Handle Loading Timeout (3 seconds)
  useEffect(() => {
    if (!isActive || !isAssetLoading || assetTimedOut) return;

    const timer = setTimeout(() => {
      console.warn(`[VideoCard] Asset timeout for slide ${currentSlideIndex}. Falling back.`);
      setAssetTimedOut(true);

      // PERSIST the recycled image into slide data
      if (currentSlideIndex > 0) {
        setSlides(prev => {
          const newSlides = [...prev];
          newSlides[currentSlideIndex] = {
            ...newSlides[currentSlideIndex],
            imageUrl: newSlides[currentSlideIndex - 1].imageUrl
          };
          return newSlides;
        });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentSlideIndex, isAssetLoading, isActive, assetTimedOut]);

  // Calculates global progress (0-100% of entire video)
  const totalSlides = slides.length;
  // Base progress from completed slides
  const baseProgress = (currentSlideIndex / totalSlides) * 100;
  // Add fraction of current slide
  const currentFraction = (slideProgress / 100) * (100 / totalSlides);
  const globalProgress = Math.min(baseProgress + currentFraction, 100);

  // Effect: Handle Slide Changes (Audio Source Update) & Playback
  useEffect(() => {
    const audio = audioRef.current;
    const bgm = bgmRef.current;

    // Helper to stop all audio
    const stopAll = () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (bgm) {
        bgm.pause();
        bgm.currentTime = 0;
      }
    };

    if (!isActive) {
      stopAll();
      return;
    }

    if (isActive && !isAssetLoading && !isPaused) {
      if (audio && currentSlide?.audioUrl) {
        audio.src = currentSlide.audioUrl;
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play blocked/failed', e));
      }
      if (bgm) {
        bgm.volume = 0.15; // Soft volume for BGM
        bgm.play().catch(e => console.log('BGM play blocked/failed', e));
      }
    } else {
      // If paused or not active, ensure audio is stopped
      if (audio) audio.pause();
      if (bgm) bgm.pause();
    }

    // Cleanup when isActive changes or component unmounts
    return () => {
      // We pause but don't reset currentTime if just switching slides, 
      // but if isActive changes (user scrolled away), we must stop all.
      if (!isActive) stopAll();
    };
  }, [isActive, currentSlideIndex, currentSlide?.audioUrl, isAssetLoading, isPaused]);


  // Effect: Monitor Audio Progress & End
  useEffect(() => {
    const audio = audioRef.current;
    if (!isActive || !audio || isAssetLoading || isPaused) return;

    if (progressTimer.current) clearInterval(progressTimer.current);

    // Audio Event Handling
    const handleNext = () => {
      if (currentSlideIndex < totalSlides - 1) {
        setSlideProgress(0);
        setAssetTimedOut(false);
        setIsPaused(false);
        setCurrentSlideIndex(prev => prev + 1);
      } else {
        // Loop video
        setSlideProgress(0);
        setAssetTimedOut(false);
        setIsPaused(false);
        setCurrentSlideIndex(0);
        // Reset BGM on loop
        if (bgmRef.current) {
          bgmRef.current.currentTime = 0;
        }
      }
    };

    const handleEnded = () => handleNext();

    audio.addEventListener('ended', handleEnded);

    // Fallback: If assets timed out and NO audio, move to next after 5s
    let timeoutTimer: NodeJS.Timeout | null = null;
    if (assetTimedOut && !currentSlide?.audioUrl) {
      timeoutTimer = setTimeout(handleNext, 5000);
    }

    // Poller for smooth progress bar
    progressTimer.current = setInterval(() => {
      if (audio.duration && audio.duration > 0) {
        setSlideProgress((audio.currentTime / audio.duration) * 100);
      } else if (assetTimedOut && !currentSlide?.audioUrl) {
        // Artificial progress if no audio
        setSlideProgress(prev => Math.min(prev + (100 / (5000 / 100)), 100));
      }
    }, 100);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [isActive, currentSlideIndex, totalSlides, isAssetLoading, assetTimedOut, currentSlide?.audioUrl, isPaused]);


  return (
    <div className={styles.card} onClick={togglePause}>
      {/* Hidden Audio Elements */}
      <audio ref={audioRef} className={styles.hidden} />
      <audio
        ref={bgmRef}
        className={styles.hidden}
        src={`/audio/bgm/${video.bgmIndex}.mp3`}
        loop
      />

      {/* Background Image/Visual */}
      <div className={styles.mediaContainer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            (currentSlide?.imageUrl && !currentSlide.imageUrl.includes("placehold.co"))
              ? currentSlide.imageUrl
              : (assetTimedOut && currentSlideIndex > 0)
                ? slides[currentSlideIndex - 1].imageUrl
                : currentSlide?.imageUrl || "https://placehold.co/600x400"
          }
          alt="Video background"
          className={`${styles.image} ${styles.activeImage}`}
        />
        <div className={styles.overlay} />
      </div>

      {/* Content Overlay */}
      <div className={styles.content}>
        {/* Global Progress Bar */}
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${globalProgress}%` }} />
        </div>

        <div className={styles.textContainer}>
          <p className={styles.subtitles}>
            {currentSlide?.text}
          </p>
        </div>

        <div className={styles.metadata}>
          <div className={styles.sourceInfo}>
            {video.title}<br />
            <span className={styles.creatorName}>Made by {video.creator}</span>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${isSaving ? styles.saving : ''}`}
          onClick={toggleSave}
          aria-label={isSaved ? "Unsave" : "Save"}
          disabled={isSaving}
        >
          <div className={styles.iconCircle}>
            {isSaving ? (
              <Loader2 size={18} className={styles.saveSpinner} />
            ) : (
              <Heart size={24} fill={isSaved ? "#FF3B30" : "rgba(0,0,0,0.2)"} color={isSaved ? "#FF3B30" : "white"} />
            )}
          </div>
          <span className={styles.actionLabel}>{isSaving ? "Saving..." : (isSaved ? "Saved" : "Save")}</span>
        </button>
        <button className={styles.actionBtn} onClick={toggleComments} aria-label="Comment">
          <div className={styles.iconCircle}>
            <MessageCircle size={24} />
          </div>
        </button>
        {video.sources && video.sources.length > 0 && (
          <button className={styles.actionBtn} onClick={toggleSources} aria-label="Sources">
            <div className={styles.iconCircle}>
              <BookOpen size={24} />
            </div>
          </button>
        )}
        <button className={styles.actionBtn} onClick={toggleQuiz} aria-label="Quiz">
          <div className={styles.iconCircle}>
            <Brain size={24} />
          </div>
        </button>
      </div>


      {/* AI Comment Drawer */}
      <CommentDrawer
        video={video}
        isOpen={isCommentOpen}
        onClose={() => setIsCommentOpen(false)}
      />

      {/* Sources Drawer */}
      {isSourceOpen && video.sources && video.sources.length > 0 && (
        <div className={styles.sourceDrawer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sourceHeader}>
            <span>{t('sources')}</span>
            <button
              onClick={() => setIsSourceOpen(false)}
              style={{ background: 'none', border: 'none', color: '#888' }}
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
          <div className={styles.sourceList}>
            {video.sources.map((source, idx) => (
              <a key={idx} href={source.href} target="_blank" rel="noopener noreferrer" className={styles.sourceItem}>
                <div className={styles.sourceFavicon} style={{
                  backgroundImage: `url(https://www.google.com/s2/favicons?sz=64&domain_url=${new URL(source.href).hostname})`,
                  backgroundSize: 'cover'
                }} />
                <div className={styles.sourceText}>
                  <div className={styles.sourceTitle}>{source.title || new URL(source.href).hostname}</div>
                  <div className={styles.sourceUrl}>{source.href}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quiz Drawer */}
      {isQuizOpen && (
        <div className={styles.quizDrawer} onClick={(e) => e.stopPropagation()}>
          <div className={styles.quizHeader}>
            <div>
              <span>{t('quiz_reflective_title')}</span>
              <p>{t('quiz_reflective_subtitle')}</p>
            </div>
            <div className={styles.quizHeaderActions}>
              <button onClick={refreshQuiz} disabled={quizLoading} aria-label={t('quiz_refresh')}>
                ↻
              </button>
              <button onClick={() => setIsQuizOpen(false)} aria-label={t('close')}>
                ✕
              </button>
            </div>
          </div>

          {quizLoading && (
            <div className={styles.quizStatus}>{t('quiz_loading')}</div>
          )}
          {quizError && (
            <div className={styles.quizError}>{quizError}</div>
          )}

          {!quizLoading && !quizError && quizData && (
            <div className={styles.quizContent}>
              {quizData.map((question) => (
                <div key={question.id} className={styles.quizQuestion}>
                  <div className={styles.quizPrompt}>
                    <span className={styles.quizBadge}>
                      {question.type === 'multiple_choice'
                        ? t('quiz_choice_label')
                        : t('quiz_open_label')}
                    </span>
                    <p>{question.prompt}</p>
                    {question.framingNote && (
                      <small>{question.framingNote}</small>
                    )}
                  </div>

                  {question.type === 'multiple_choice' && question.options ? (
                    <div className={styles.quizOptions}>
                      {question.options.map((option) => {
                        const isSelected = quizResponses[question.id]?.value === option.id;
                        return (
                          <button
                            key={option.id}
                            className={`${styles.quizOption} ${isSelected ? styles.quizOptionSelected : ''}`}
                            onClick={() => setQuizValue(question.id, option.id)}
                          >
                            <span>{option.label}</span>
                            {option.description && <small>{option.description}</small>}
                          </button>
                        );
                      })}
                      <textarea
                        className={styles.quizReasoning}
                        placeholder={t('quiz_choice_reason_placeholder')}
                        value={quizResponses[question.id]?.reasoning || ''}
                        onChange={(e) => setQuizReasoning(question.id, e.target.value)}
                      />
                    </div>
                  ) : (
                    <textarea
                      className={styles.quizTextarea}
                      placeholder={t('quiz_open_placeholder')}
                      value={quizResponses[question.id]?.value || ''}
                      onChange={(e) => setQuizValue(question.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {quizFeedback && (
            <div className={styles.quizFeedback}>
              <strong>{quizFeedback.overallReflection}</strong>
              <ul>
                {quizFeedback.questionFeedback.map((item) => (
                  <li key={item.questionId}>
                    <p>{item.feedback}</p>
                    {item.nudge && <small>{item.nudge}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {quizData && (
            <button
              className={styles.quizSubmit}
              onClick={submitQuiz}
              disabled={!isQuizReady || quizSubmitting}
            >
              {quizSubmitting ? t('quiz_feedback_loading') : t('quiz_feedback_cta')}
            </button>
          )}
        </div>
      )}

      {/* Pause Overlay Feedback */}
      {showPauseFeedback && (
        <div className={styles.pauseOverlay}>
          {isPaused ? (
            <Pause size={64} className={styles.pauseIcon} />
          ) : (
            <Play size={64} className={styles.pauseIcon} />
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isAssetLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <div className={styles.loadingText}>{t('preparingInsight')}</div>
        </div>
      )}

      {/* Bottom Modifier */}
      <div className={styles.modifierWrapper}>
        <div className={styles.modifierInput} role="button" tabIndex={0}>
          <span>{t('typeToModify')}</span>
          <ArrowUpCircle size={20} color="#FF6B35" />
        </div>
      </div>
    </div>
  );
}
