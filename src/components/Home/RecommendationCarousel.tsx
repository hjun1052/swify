"use client";

import React from 'react';
import styles from './RecommendationCarousel.module.css';
import { Play } from 'lucide-react';

export interface CarouselItem {
  id: string;
  title: string;
  category: string;
  image: string;
  query?: string;
}

interface Props {
  title: string;
  items: CarouselItem[];
  onSelect: (term: string) => void;
  loading?: boolean;
}

export default function RecommendationCarousel({ title, items, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.heading}>{title}</h2>
        <div className={styles.scrollArea}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.scrollArea}>
        {items.map((item) => (
          <button
            key={item.id}
            className={styles.card}
            onClick={() => onSelect(item.query || item.title)}
            style={{ backgroundImage: `url(${item.image})` }}
          >
            <div className={styles.overlay} />
            <div className={styles.content}>
              <span className={styles.category}>{item.category}</span>
              <h3 className={styles.title}>{item.title}</h3>
              <div className={styles.playIcon}>
                <Play size={16} fill="white" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
