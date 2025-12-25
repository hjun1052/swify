"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./Profile.module.css";
import { Settings, X, LogOut, User } from "lucide-react";
import { useSettings, Language, VideoLength } from "@/lib/store";

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { settings, updateSettings, t } = useSettings();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const openSettings = () => {
    setIsOpen(false);
    setShowSettings(true);
  };

  return (
    <>
      {/* Dropdown Trigger */}
      <div className={styles.profileContainer} ref={dropdownRef}>
        <button className={styles.avatarBtn} onClick={toggleDropdown} aria-label="Open profile menu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.pravatar.cc/150?u=swify"
            alt="User Profile"
            className={styles.avatarImg}
          />
        </button>

        {isOpen && (
          <div className={styles.dropdownMenu}>
            <button className={styles.menuItem}>
              <User size={18} /> {t('profile')}
            </button>
            <button className={styles.menuItem} onClick={openSettings}>
              <Settings size={18} /> {t('settingsTitle')}
            </button>
            <div className={styles.separator} />
            <button className={`${styles.menuItem} ${styles.logoutBtn}`}>
              <LogOut size={18} /> {t('logout')}
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          settings={settings}
          onUpdate={updateSettings}
          t={t}
        />
      )}
    </>
  );
}

interface SettingsModalProps {
  onClose: () => void;
  settings: { language: Language; videoLength: VideoLength };
  onUpdate: (s: Partial<{ language: Language; videoLength: VideoLength }>) => void;
  t: (k: string) => string;
}

function SettingsModal({ onClose, settings, onUpdate, t }: SettingsModalProps) {
  // Local state for immediate feedback before save? Or instantaneous?
  // Let's do instantaneous update for simplicity, user can just close.
  // Or proper form. Let's do instantaneous with visual feedback.

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.modalTitle}>{t('settingsTitle')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('language')}</h3>
          <div className={styles.optionsGrid}>
            {(['en', 'ko', 'es', 'ja'] as Language[]).map(lang => (
              <button
                key={lang}
                className={`${styles.optionChip} ${settings.language === lang ? styles.optionChipActive : ''}`}
                onClick={() => onUpdate({ language: lang })}
              >
                {lang === 'en' ? 'English' : lang === 'ko' ? '한국어' : lang === 'es' ? 'Español' : '日本語'}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('videoLength')}</h3>
          <div className={styles.optionsGrid}>
            {(['short', 'medium', 'long'] as VideoLength[]).map(len => (
              <button
                key={len}
                className={`${styles.optionChip} ${settings.videoLength === len ? styles.optionChipActive : ''}`}
                onClick={() => onUpdate({ videoLength: len })}
              >
                {t(len)}
              </button>
            ))}
          </div>
        </div>

        <button className={styles.saveBtn} onClick={onClose}>
          {t('done')}
        </button>
      </div>
    </div>
  )
}
