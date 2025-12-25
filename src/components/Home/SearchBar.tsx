"use client";

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

import { useSettings } from '@/lib/store';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const { t } = useSettings();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      onSearch(query);
    }
  };

  const handleIconClick = () => {
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className={styles.wrapper}>
      <input
        type="text"
        className={styles.input}
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className={styles.iconButton}
        onClick={handleIconClick}
        aria-label="Search"
      >
        <Search size={22} color="var(--color-primary-orange)" />
      </button>
    </div>
  );
}
