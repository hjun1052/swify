"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Trash2 } from 'lucide-react';
import { VideoShort } from '@/app/api/generate/route';
import styles from './page.module.css';
import { useSettings } from '@/lib/store';

interface ReflectionEntry {
  id: string;
  question: string;
  answer: string;
  reflectionDate: string;
  summary?: {
    categories?: { category: string; count: number }[];
    titles?: string[];
  } | null;
}

export default function LibraryPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [reflectionsLoading, setReflectionsLoading] = useState(true);
  const hasLoaded = useRef(false);
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState<'videos' | 'reflections'>('videos');
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (hasLoaded.current) return;

    const fetchData = async () => {
      try {
        const [videoRes, reflectionRes] = await Promise.all([
          fetch('/api/library'),
          fetch('/api/reflections')
        ]);

        const videoData = await videoRes.json();
        setVideos(videoData);
        setLoading(false);

        const reflectionData = reflectionRes.ok ? await reflectionRes.json() : [];
        setReflections(reflectionData);
      } catch (err) {
        console.error("Failed to load library data", err);
        setLoading(false);
      } finally {
        setReflectionsLoading(false);
      }
    };

    fetchData();
    hasLoaded.current = true;
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/library?id=${id}`, { method: 'DELETE' });
      const updated = videos.filter(v => v.id !== id);
      setVideos(updated);
    } catch (err) {
      console.error("Failed to delete video", err);
    }
  };

  const handlePlay = (id: string) => {
    router.push(`/feed?savedId=${id}`);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 60;
    if (Math.abs(delta) > threshold) {
      if (delta < 0) {
        setActiveTab('reflections');
      } else {
        setActiveTab('videos');
      }
    }
    touchStartX.current = null;
  };

  const renderVideos = () => {
    if (loading) {
      return (
        <div className={styles.empty}>
          <p>{t('library_videos_loading')}</p>
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className={styles.empty}>
          <p>{t('library_videos_empty')}</p>
          <button className={styles.browseBtn} onClick={() => router.push('/')}>
            {t('library_explore_cta')}
          </button>
        </div>
      );
    }

    return (
      <div className={styles.grid}>
        {videos.map((video) => (
          <div
            key={video.id}
            className={styles.card}
            onClick={() => handlePlay(video.id)}
          >
            <div className={styles.thumbnail}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.slides[0].imageUrl} alt={video.title} />
              <div className={styles.playOverlay}>
                <Play size={32} fill="white" color="white" />
              </div>
            </div>
            <div className={styles.info}>
              <h3 className={styles.videoTitle}>{video.title}</h3>
              <p className={styles.videoMeta}>{video.slides.length} slides • {video.creator}</p>
            </div>
            <button
              className={styles.deleteBtn}
              onClick={(e) => {
                handleDelete(video.id, e);
              }}
              aria-label="Remove from library"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderReflections = () => {
    if (reflectionsLoading) {
      return <p className={styles.empty}>{t('library_reflection_loading')}</p>;
    }
    if (reflections.length === 0) {
      return <p className={styles.emptyText}>{t('library_reflection_empty')}</p>;
    }
    return (
      <div className={styles.reflectionList}>
        {reflections.map((reflection) => (
          <div key={reflection.id} className={styles.reflectionCard}>
            <p className={styles.reflectionDate}>
              {new Date(reflection.reflectionDate).toLocaleDateString()}
            </p>
            <h3>{reflection.question}</h3>
            <p className={styles.reflectionAnswer}>{reflection.answer}</p>
            {reflection.summary?.categories && (
              <div className={styles.reflectionCategories}>
                {reflection.summary.categories.map((cat) => (
                  <span key={cat.category}>{cat.category} · {cat.count}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/')} aria-label={t('back')}>
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.title}>{t('library_title')}</h1>
      </header>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tabButton} ${activeTab === 'videos' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          {t('library_videos_tab')}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'reflections' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('reflections')}
        >
          {t('library_reflections_tab')}
        </button>
      </div>

      <div className={styles.tabPanel}>
        {activeTab === 'videos' ? (
          renderVideos()
        ) : (
          <>
            <h2 className={styles.sectionTitle}>{t('library_reflection_section_title')}</h2>
            {renderReflections()}
          </>
        )}
      </div>
    </div>
  );
}
