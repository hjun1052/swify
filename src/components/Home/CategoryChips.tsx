"use client";

import React, { useState } from 'react';
import { Sparkles, Compass, Lightbulb, TrendingUp, FileText } from 'lucide-react';
import styles from './CategoryChips.module.css';

const CATEGORIES = [
  { id: 'learn', label: 'Learn', icon: Lightbulb, color: '#FCD34D' }, // Yellow-ish
  { id: 'explore', label: 'Explore', icon: Compass, color: '#FCA5A5' }, // Red-ish
  { id: 'research', label: 'Research', icon: FileText, color: '#93C5FD' }, // Blue-ish
  { id: 'invest', label: 'Invest', icon: TrendingUp, color: '#6EE7B7' }, // Green-ish
  { id: 'brief', label: 'Brief', icon: Sparkles, color: '#C4B5FD' }, // Purple-ish
];

interface CategoryChipsProps {
  onSelect: (id: string) => void;
}

export default function CategoryChips({ onSelect }: CategoryChipsProps) {
  const [active, setActive] = useState('learn');

  const handleSelect = (id: string) => {
    setActive(id);
    onSelect(id);
  };

  return (
    <div className={styles.scrollWrapper}>
      <div className={styles.track}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              className={`${styles.chip} ${isActive ? styles.active : ''}`}
              onClick={() => handleSelect(cat.id)}
              style={{ backgroundColor: isActive ? cat.color : '#FFFFFF' } as React.CSSProperties}
            >
              <Icon size={18} className={styles.icon} />
              <span className={styles.label}>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
