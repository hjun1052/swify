"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Greeting from '@/components/Home/Greeting';
import SearchBar from '@/components/Home/SearchBar';
import CategoryChips from '@/components/Home/CategoryChips';
import styles from './page.module.css';

import { Library, Trees } from 'lucide-react';
import RecommendationCarousel, { CarouselItem } from '@/components/Home/RecommendationCarousel';
import ProfileDropdown from '@/components/Profile/ProfileDropdown';
import { useSettings } from '@/lib/store';
import TodayReview from '@/components/Home/TodayReview';

interface HomeContent {
  briefing: CarouselItem[];
  issues: CarouselItem[];
  facts: CarouselItem[];
}

const CACHE_KEY_BASE = 'swify_home_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default function Home() {
  const router = useRouter();
  const { settings, t } = useSettings();
  const [category, setCategory] = useState('learn');
  const [content, setContent] = useState<HomeContent | null>(null);
  const [loading, setLoading] = useState(true);

  // Translate Mock Recommendations based on current language
  const localizedRecommendations = useMemo(() => [
    { id: 'r1', title: t('rec_ship'), category: 'EXPLORE', image: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=600' },
    { id: 'r2', title: t('rec_ai'), category: 'LEARN', image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=600' },
    { id: 'r3', title: t('rec_crypto'), category: 'INVEST', image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=600' },
  ], [t]);

  useEffect(() => {
    async function fetchHomeContent() {
      const language = settings.language;
      const CACHE_KEY = `${CACHE_KEY_BASE}_${language}`;

      // 1. Check Cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { timestamp, data } = JSON.parse(cached);
          const isExpired = Date.now() - timestamp > CACHE_TTL;
          if (!isExpired && data) {
            setContent(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Home cache parse error", e);
        }
      }

      // 2. Fetch from API if cache invalid or missing
      try {
        setLoading(true);
        const res = await fetch(`/api/home/content?lang=${language}`);
        if (res.ok) {
          const data = await res.json();
          setContent(data);
          // 3. Save to Cache
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data
          }));
        }
      } catch (error) {
        console.error("Failed to load home content:", error);
      } finally {
        setLoading(false);
      }
    }

    if (settings.language) {
      fetchHomeContent();
    }
  }, [settings.language]);

  const handleSearch = (query: string) => {
    router.push(`/feed?q=${encodeURIComponent(query)}&style=${category}`);
  };

  const handleCategorySelect = (id: string) => {
    setCategory(id);
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className={styles.iconButton} onClick={() => router.push('/library')} aria-label={t('library')}>
            <Library size={24} />
          </button>
          <button className={styles.iconButton} onClick={() => router.push('/forest')} aria-label={t('forest')}>
            <Trees size={24} />
          </button>
        </div>
        <ProfileDropdown />
      </header>

      <div className={styles.content}>
        <Greeting userName="JunHyuk" />
        <SearchBar onSearch={handleSearch} />
        <CategoryChips onSelect={handleCategorySelect} />
        <TodayReview />

        <RecommendationCarousel
          title={t('recommended')}
          items={localizedRecommendations}
          onSelect={handleSearch}
        />

        <RecommendationCarousel
          title={t('briefing')}
          items={content?.briefing || []}
          onSelect={handleSearch}
          loading={loading}
        />

        <RecommendationCarousel
          title={t('issues')}
          items={content?.issues || []}
          onSelect={handleSearch}
          loading={loading}
        />

        <RecommendationCarousel
          title={t('facts')}
          items={content?.facts || []}
          onSelect={handleSearch}
          loading={loading}
        />

        <div style={{ height: '80px' }} />
      </div>
    </main>
  );
}
