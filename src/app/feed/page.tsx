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
  const [toast, setToast] = useState<{ visible: boolean; message: string; duration?: number }>({ visible: false, message: "" });

  const fetchedQueries = React.useRef<Set<string>>(new Set());
  // We need to track how many videos we've generated in the *current* auto-gen sequence
  // Since 'videos' grows indefinitely, we can use (videos.length % BATCH_SIZE) logic or a ref.
  // Using a ref for the current batch count is safer for async closures.
  const currentBatchCount = React.useRef(0);

  const fetchVideoSequence = useCallback(async (query: string, isInitial = false, insertAfterIndex = -1) => {
    if (!query || fetchedQueries.current.has(query)) return;

    // Check batch limit BEFORE fetching (only for auto-gen, not manual modify)
    if (insertAfterIndex === -1 && currentBatchCount.current >= BATCH_SIZE) {
      console.log("[Auto-Gen] Batch limit reached. Stopping auto-gen.");
      return;
    }

    fetchedQueries.current.add(query);
    if (isInitial) setLoading(true);

    try {
      console.log(`[Gen] Fetching: ${query}`);

      const styleParam = searchParams.get('style') || 'learn';
      // If manually modifying (insertAfterIndex > -1), request just 1 video for speed/focus
      const limit = insertAfterIndex > -1 ? 1 : undefined;

      const res = await fetch(`/api/generate?q=${encodeURIComponent(query)}&lang=${settings.language}&len=${settings.videoLength}&style=${styleParam}${limit ? `&limit=${limit}` : ''}`);
      const data = await res.json();
      console.log(`[Gen] API Response:`, data);
      const newVideos: VideoShort[] = data.videos || [];
      console.log(`[Gen] New Videos Count:`, newVideos.length);

      if (newVideos.length > 0) {
        setVideos(prev => {
          // If inserting specifically after a video
          if (insertAfterIndex > -1) {
            console.log(`[Gen] Inserting at index ${insertAfterIndex + 1}`);
            const updated = [...prev];
            // Filter out duplicates if any
            const uniqueNew = newVideos.filter(nv => !prev.some(pv => pv.id === nv.id));
            if (uniqueNew.length === 0) console.warn("[Gen] No unique videos to insert");
            updated.splice(insertAfterIndex + 1, 0, ...uniqueNew);
            return updated;
          }

          const exists = prev.some(v => v.id === newVideos[0].id);
          if (exists) return prev;
          return [...prev, ...newVideos];
        });

        // Increment batch count only for auto-chain
        if (insertAfterIndex === -1) {
          currentBatchCount.current += 1;
        }

        if (!isInitial) {
          setToast({
            visible: true,
            message: `${t('generationComplete') || 'Done!'} Scroll down to see: ${newVideos[0].title}`,
            duration: 5000
          });
        }

        // Only trigger next auto-gen if not manual modify and limit not hit
        if (insertAfterIndex === -1 && currentBatchCount.current < BATCH_SIZE) {
          const nextQuery = newVideos[0].suggestedNextQuery;
          if (nextQuery) {
            console.log(`[Auto-Gen] Queuing next: ${nextQuery}`);
            setTimeout(() => {
              triggerNextRef.current(nextQuery);
            }, 1000);
          }
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

  const handleModify = (query: string, index: number) => {
    console.log(`[User] Modifying feed with: ${query} at index ${index}`);

    // Capture context from current video
    const currentVideo = videos[index];
    const contextQuery = currentVideo ? `${currentVideo.title} regarding ${query}` : query;

    setToast({ visible: true, message: `Thinking: ${query}... This may take a moment.`, duration: 0 }); // Persistent

    // Fetch and Insert immediately after current index with context-aware query
    fetchVideoSequence(contextQuery, false, index);
  };

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
          onModify={handleModify}
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
        duration={toast.duration}
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
