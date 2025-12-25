"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Trash2 } from 'lucide-react';
import { VideoShort } from '@/app/api/generate/route';
import styles from './page.module.css';

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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/')} aria-label="Back to Home">
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.title}>Your Library</h1>
      </header>

      {loading ? (
        <div className={styles.empty}>
          <p>Loading your treasures...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className={styles.empty}>
          <p>No saved videos yet.</p>
          <button className={styles.browseBtn} onClick={() => router.push('/')}>
            Explore Insights
          </button>
        </div>
      ) : (
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
                onClick={(e) => handleDelete(video.id, e)}
                aria-label="Remove from library"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <section className={styles.reflectionSection}>
        <h2 className={styles.sectionTitle}>오늘의 회고 기록</h2>
        {reflectionsLoading ? (
          <p className={styles.empty}>회고를 불러오는 중...</p>
        ) : reflections.length === 0 ? (
          <p className={styles.emptyText}>아직 저장된 회고가 없어요. 홈에서 오늘 돌아보기를 시작해보세요.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
