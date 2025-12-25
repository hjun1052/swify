"use client";

import React, { useEffect, useState } from "react";
import styles from "./RecommendationCard.module.css";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";

import { useSettings } from "@/lib/store";

interface RecommendationCardProps {
  baseTopic: string;
  onSelectTopic: (topic: string) => void;
}

export default function RecommendationCard({ baseTopic, onSelectTopic }: RecommendationCardProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useSettings();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/suggest?topic=${encodeURIComponent(baseTopic)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [baseTopic]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Sparkles size={32} color="#FF6B35" />
        </div>
        <h2 className={styles.title}>
          {t('suggestionTitle')}<br />
          <span className={styles.highlight}>{t('suggestionSubtitle')}</span>
        </h2>

        {loading ? (
          <div className={styles.loaderWrapper}>
            <Loader2 className={styles.spinner} size={32} />
            <p>{t('loadingSuggestions')}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {suggestions.map((topic, i) => (
              <button
                key={i}
                className={styles.card}
                onClick={() => onSelectTopic(topic)}
              >
                <span>{topic}</span>
                <ArrowRight size={16} className={styles.arrow} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
