"use client";

import React, { useRef, useEffect, useState } from 'react';
import { VideoShort } from '@/app/api/generate/route';
import VideoCard from './VideoCard';
import styles from './VideoFeed.module.css';

interface VideoFeedProps {
  videos: VideoShort[];
  onModify?: (query: string) => void;
}

export default function VideoFeed({ videos, endCard, onModify }: VideoFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          setActiveIndex(index);
        }
      });
    }, {
      root: container,
      threshold: 0.6 // 60% visibility required to be "active"
    });

    const sections = container.querySelectorAll(`.${styles.wrapper}`);
    sections.forEach(section => observer.observe(section));

    return () => observer.disconnect();
  }, [videos, endCard]);

  return (
    <div className={styles.container} ref={containerRef}>
      {videos.map((video, index) => (
        <div
          key={video.id}
          className={styles.wrapper}
          data-index={index}
        >
          <VideoCard
            video={video}
            isActive={index === activeIndex}
            onModify={onModify}
          />
        </div>
      ))}

      {endCard && (
        <div
          className={styles.wrapper}
          data-index={videos.length}
        >
          {endCard}
        </div>
      )}
    </div>
  );
}
