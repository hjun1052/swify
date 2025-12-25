"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getTranslation } from "./translations";

export type Language = "en" | "ko" | "es" | "ja";
export type VideoLength = "short" | "medium" | "long";

export interface Settings {
  language: Language;
  videoLength: VideoLength;
}

const DEFAULT_SETTINGS: Settings = {
  language: "en",
  videoLength: "medium",
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  loaded: boolean;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("swify_settings");
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      localStorage.setItem("swify_settings", JSON.stringify(next));
      return next;
    });
  };

  const t = (key: string) => {
    return getTranslation(settings.language, key);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loaded, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
