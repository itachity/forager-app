"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LanguageCode } from "./forager-types";
import { translate, type I18nKey } from "./forager-i18n";
import { loadProfileLocal, saveProfileLocal } from "./forager-profile";
import { saveProfileRemote } from "./forager-supabase";

type I18nContextValue = {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  t: (key: I18nKey) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => translate("en", key),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>("en");

  useEffect(() => {
    const profile = loadProfileLocal();
    if (profile?.language?.preferredLanguage) {
      setLangState(profile.language.preferredLanguage);
    }
  }, []);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    if (typeof window === "undefined") return;
    const profile = loadProfileLocal();
    if (!profile) return;
    const updated = {
      ...profile,
      language: { ...profile.language, preferredLanguage: next },
      updatedAt: new Date().toISOString(),
    };
    saveProfileLocal(updated);
    if (updated.profileMode !== "guest" && updated.authUserId) {
      void saveProfileRemote(updated);
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: I18nKey) => translate(lang, key),
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
