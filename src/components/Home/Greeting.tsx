import React from 'react';
import styles from './Greeting.module.css';

import { useSettings } from '@/lib/store';

interface GreetingProps {
  userName?: string;
}

export default function Greeting({ userName = "Reviewer" }: GreetingProps) {
  const { t } = useSettings();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('greeting')}<br />
        <span className={styles.name}>{userName}!</span>
      </h1>
    </div>
  );
}
