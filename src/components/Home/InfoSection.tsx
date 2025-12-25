"use client";

import React from 'react';
import styles from './InfoSection.module.css';

interface InfoItem {
  icon?: React.ReactNode;
  text: string;
  subtext?: string;
}

interface Props {
  title: string;
  items: InfoItem[];
  color?: string; // Accent color
}

export default function InfoSection({ title, items, color = '#3B82F6' }: Props) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle} style={{ borderLeftColor: color }}>
        {title}
      </h3>
      <div className={styles.list}>
        {items.map((item, idx) => (
          <div key={idx} className={styles.item}>
            {item.icon && <div className={styles.iconWrapper} style={{ color }}>{item.icon}</div>}
            <div className={styles.textContent}>
              <p className={styles.mainText}>{item.text}</p>
              {item.subtext && <p className={styles.subText}>{item.subtext}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
