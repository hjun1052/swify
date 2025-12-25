"use client";

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoFeed from '@/components/Feed/VideoFeed';
import { VideoShort } from '@/app/api/generate/route';
import { Loader2, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

import Toast from '@/components/UI/Toast';
import RecommendationCard from '@/components/Feed/RecommendationCard';

import { useSettings } from '@/lib/store';

const BATCH_SIZE = 4;

function FeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');

  const { settings, loaded, t } = useSettings();

  const [videos, setVideos] = useState<VideoShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: "" });

  const fetchedQueries = React.useRef<Set<string>>(new Set());
  // We need to track how many videos we've generated in the *current* auto-gen sequence
  // Since 'videos' grows indefinitely, we can use (videos.length % BATCH_SIZE) logic or a ref.
  // Using a ref for the current batch count is safer for async closures.
  const currentBatchCount = React.useRef(0);

  const fetchVideoSequence = useCallback(async (query: string, isInitial = false) => {
    if (!query || fetchedQueries.current.has(query)) return;

    // Check batch limit BEFORE fetching
    if (currentBatchCount.current >= BATCH_SIZE) {
      console.log("[Auto-Gen] Batch limit reached. Stopping auto-gen.");
      return;
    }

    fetchedQueries.current.add(query);
    if (isInitial) setLoading(true);

    try {
      console.log(`[Auto-Gen] Fetching: ${query} (Batch: ${currentBatchCount.current + 1}/${BATCH_SIZE})`);
      // Use current settings from hook (captured in closure or passed?)
      // Since fetchVideoSequence is created once (toggled by dependencies), we need to ensure it uses latest settings.

      const styleParam = searchParams.get('style') || 'learn';
      const res = await fetch(`/api/generate?q=${encodeURIComponent(query)}&lang=${settings.language}&len=${settings.videoLength}&style=${styleParam}`);
      const data = await res.json();
      const newVideos: VideoShort[] = data.videos || [];

      if (newVideos.length > 0) {
        setVideos(prev => {
          const exists = prev.some(v => v.id === newVideos[0].id);
          if (exists) return prev;
          return [...prev, ...newVideos];
        });

        // Increment batch count on success
        currentBatchCount.current += 1;

        if (!isInitial) {
          setToast({ visible: true, message: `Up next: ${newVideos[0].title}` });
        }

        // Only trigger next if we haven't hit the limit
        if (currentBatchCount.current < BATCH_SIZE) {
          const nextQuery = newVideos[0].suggestedNextQuery;
          if (nextQuery) {
            console.log(`[Auto-Gen] Queuing next: ${nextQuery}`);
            setTimeout(() => {
              triggerNextRef.current(nextQuery);
            }, 1000);
          }
        } else {
          console.log("[Auto-Gen] Batch complete. Ready for recommendations.");
          // Force re-render to show end card if needed? State update above handles it.
        }
      }
    } catch (error) {
      console.error("Failed to fetch videos", error);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [settings, setLoading, setVideos, setToast, searchParams]);

  // Helper to trigger recursion cleanly without dependency cycle
  const triggerNextRef = React.useRef<(q: string) => void>(() => { });
  triggerNextRef.current = useCallback((q: string) => {
    fetchVideoSequence(q, false);
  }, [fetchVideoSequence]);

  useEffect(() => {
    const savedId = searchParams.get('savedId');
    if (savedId) {
      // Fetch from DB instead of localStorage
      fetch('/api/library')
        .then(res => res.json())
        .then((library: VideoShort[]) => {
          const target = library.find(v => v.id === savedId);
          if (target) {
            setVideos([target]);
            setLoading(false);
          } else {
            setToast({ visible: true, message: "Video not found in library" });
            setLoading(false);
          }
        })
        .catch(err => {
          console.error("Failed to fetch saved video", err);
          setLoading(false);
        });
      return;
    }

    if (initialQuery && loaded) {
      // New search = New batch
      currentBatchCount.current = 0;
      fetchVideoSequence(initialQuery, true);
    }
  }, [initialQuery, fetchVideoSequence, loaded, searchParams]);

  // Restart a new batch from a recommendation
  const handleRecommendationSelect = (topic: string) => {
    console.log(`[User] Selected new topic: ${topic}`);
    // Scroll to the new video? We'll append it.
    currentBatchCount.current = 0; // Reset batch count
    fetchVideoSequence(topic, false);
  };

  if (loading && videos.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.spinner} size={48} color="#FF6B35" />
        <p className={styles.loadingText}>Generating your feed...</p>
      </div>
    );
  }

  if (videos.length === 0 && !loading) {
    return (
      <div className={styles.loadingContainer}>
        <p>No videos found. Search for &quot;Christmas&quot; or &quot;Tech&quot;.</p>
      </div>
    );
  }

  // Show end card if we have a full batch (multiple of 4) and not loading initial
  // Actually, just show it at the end of the list always?
  // User wants: "After 4 videos... show recommendations".
  // So if videos.length >= 4, show it at the end.
  // We can pass the base topic as the LAST video's title or suggestedNextQuery
  const lastVideo = videos[videos.length - 1];
  const showEndCard = videos.length > 0 && (videos.length % BATCH_SIZE === 0);

  return (
    <>
      <div className={styles.feedWrapper}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/')}
          aria-label={t('back')}
        >
          <ArrowLeft size={20} />
        </button>
        <VideoFeed
          videos={videos}
          endCard={showEndCard ? (
            <RecommendationCard
              baseTopic={lastVideo.title} // Or use the query that generated it? Title is fine.
              onSelectTopic={handleRecommendationSelect}
            />
          ) : null}
        />
      </div>
      <Toast
        message={toast.message}
        isVisible={toast.visible}
        onClose={() => setToast({ ...toast, visible: false })}
        onClick={() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          setToast({ ...toast, visible: false });
        }}
      />
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FeedContent />
    </Suspense>
  );
}
