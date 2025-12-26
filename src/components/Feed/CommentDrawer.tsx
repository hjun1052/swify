"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Sparkles } from 'lucide-react';
import styles from './CommentDrawer.module.css';
import { VideoShort } from '@/app/api/generate/route';
import { useSettings } from '@/lib/store';

interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
}

interface CommentDrawerProps {
  video: VideoShort;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentDrawer({ video, isOpen, onClose }: CommentDrawerProps) {
  const { t } = useSettings();
  const baseIntro = t('comment_intro').replace('{title}', video.title);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'ai', text: baseIntro }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ id: '1', type: 'ai', text: t('comment_intro').replace('{title}', video.title) }]);
    setInput('');
  }, [video.id, video.title, t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), type: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          videoContent: video.slides.map(s => s.text).join('\n')
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: Message = { id: (Date.now() + 1).toString(), type: 'ai', text: data.answer };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error("Failed to get answer");
      }
    } catch {
      setMessages(prev => [...prev, { id: 'err', type: 'ai', text: t('comment_error') }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={e => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <Sparkles size={18} color="#FF6B35" />
            <h3>{t('comment_title')}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('comment_close_aria')}>
            <X size={24} />
          </button>
        </header>

        <div className={styles.messageList} ref={scrollRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`${styles.message} ${styles[msg.type]}`}>
              <div className={styles.bubble}>{msg.text}</div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.message} ${styles.ai}`}>
              <div className={styles.bubble}>
                <Loader2 className={styles.spinner} size={16} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.inputArea}>
          <input
            className={styles.input}
            placeholder={t('comment_placeholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || loading} aria-label={t('comment_send_aria')}>
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
