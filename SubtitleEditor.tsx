import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import isEqual from "lodash/isEqual";
import { Loading } from "./components/Loading";
import { ToastProvider, useToast } from "./components/ToastContext";
import Sub, { type SubPayload } from "./lib/Sub";
import DT from "duration-time-conversion";
import type WFPlayer from "wfplayer";
import PlayerPanel from "./PlayerPanel";
import SubtitleList from "./SubtitleList";
import ToolPanel from "./ToolPanel";
import FooterPanel from "./FooterPanel";
import {
  LOCAL_SUBTITLE_KEY,
  SAMPLE_SUBTITLE_URL,
  SAMPLE_VIDEO_URL,
  MAX_LOCAL_SUBTITLE_FILES,
} from "./constants";
import type {
  SubtitleEditorProps,
  SubtitleEditorShared,
  MultiLangStoredData,
} from "./types";
import { file2sub } from "./lib/readSub";
import { getExt, getFileNameFromPath } from "./utils";

type StoredSubPayload = Pick<SubPayload, "start" | "end" | "text" | "text2">;
type SubtitleStorageRecord = Record<
  string,
  StoredSubPayload[] | MultiLangStoredData
>;
interface SubtitleStorageState {
  items: SubtitleStorageRecord;
  order: string[];
}

const DEFAULT_STORAGE_KEY = "default";
const DEFAULT_LANG = "en";

const createEmptyStorage = (): SubtitleStorageState => ({
  items: {},
  order: [],
});

const toStoredSubtitle = (subs: Sub[]): StoredSubPayload[] =>
  subs.map((item) => ({
    start: item.start,
    end: item.end,
    text: item.text,
    text2: item.text2,
  }));

const parseSubtitleRecord = (raw: string | null): SubtitleStorageState => {
  if (!raw) return createEmptyStorage();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        items: { [DEFAULT_STORAGE_KEY]: parsed } as SubtitleStorageRecord,
        order: [DEFAULT_STORAGE_KEY],
      };
    }
    if (parsed && typeof parsed === "object") {
      if (
        "items" in parsed &&
        "order" in parsed &&
        Array.isArray((parsed as any).order)
      ) {
        const items = { ...(parsed as { items: SubtitleStorageRecord }).items };
        const order = ((parsed as { order: string[] }).order || []).filter(
          (key) => key in items
        );
        return { items, order };
      }
      const items = parsed as SubtitleStorageRecord;
      const order = Object.keys(items);
      return { items, order };
    }
  } catch {
    return createEmptyStorage();
  }
  return createEmptyStorage();
};

function SubtitleEditorInner({
  initialLanguage,
  className,
  subtitleUrl,
  subtitleUrls,
  videoUrl,
  persistToLocal = true,
}: SubtitleEditorProps) {
  const subtitleHistory = useRef<Sub[][]>([]);
  const [player, setPlayer] = useState<HTMLVideoElement | null>(null);
  const [waveform, setWaveform] = useState<WFPlayer | null>(null);
  const [loading, setLoading] = useState("");
  const [processing, setProcessing] = useState(0);
  const [language, setLanguage] = useState(initialLanguage || "en");

  // Multi-language states
  const [currentLang, setCurrentLang] = useState<string>(DEFAULT_LANG);
  const [originalLang, setOriginalLang] = useState<string>(DEFAULT_LANG);
  const [translations, setTranslations] = useState<Record<string, Sub[]>>({});
  const translatedLangs = useMemo(
    () => Object.keys(translations),
    [translations]
  );

  // subtitle 从 translations[currentLang] 获取
  const subtitle = useMemo(
    () => translations[currentLang] || [],
    [translations, currentLang]
  );

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const { success, error, info, warning } = useToast();
  const resolvedSubtitleUrl = subtitleUrl || SAMPLE_SUBTITLE_URL;
  const resolvedVideoUrl = videoUrl || SAMPLE_VIDEO_URL;
  const shouldPersistLocal = persistToLocal;
  const subtitleStorageKey = useMemo(() => {
    const fileName = getFileNameFromPath(resolvedSubtitleUrl);
    return (fileName || DEFAULT_STORAGE_KEY).toLowerCase();
  }, [resolvedSubtitleUrl]);
  const [videoSource, setVideoSource] = useState(resolvedVideoUrl);

  useEffect(() => {
    setVideoSource(resolvedVideoUrl);
  }, [resolvedVideoUrl]);

  useEffect(() => {
    setLanguage(initialLanguage || "en");
  }, [initialLanguage]);

  const newSub = useCallback((item: SubPayload) => new Sub(item), []);
  const hasSub = useCallback((sub: Sub) => subtitle.indexOf(sub), [subtitle]);

  const formatSub = useCallback(
    (sub: SubPayload | Sub | Array<SubPayload | Sub>) => {
      if (Array.isArray(sub)) {
        return sub.map((item) => newSub(item as SubPayload));
      }
      return newSub(sub as SubPayload);
    },
    [newSub]
  );

  const copySubs = useCallback(
    () => subtitle.map((item) => item.clone),
    [subtitle]
  );

  // Multi-language methods
  const switchLanguage = useCallback(
    (lang: string) => {
      if (lang in translations) {
        setCurrentLang(lang);
      }
    },
    [translations]
  );

  const removeLanguage = useCallback(
    (lang: string) => {
      if (lang === originalLang) {
        // Cannot remove original language
        return;
      }
      setTranslations((prev) => {
        const updated = { ...prev };
        delete updated[lang];
        return updated;
      });
      // If current language is removed, switch to original language
      if (lang === currentLang) {
        setCurrentLang(originalLang);
      }
    },
    [originalLang, currentLang]
  );

  const addTranslation = useCallback((lang: string, subs: Sub[]) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: subs,
    }));
  }, []);

  const persistSubtitle = useCallback(() => {
    if (!shouldPersistLocal) return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LOCAL_SUBTITLE_KEY);
    const state = parseSubtitleRecord(raw);
    const items = { ...state.items };
    let order = state.order.filter((key) => key in items);

    // Convert all languages to stored format
    const translationsToStore: Record<string, StoredSubPayload[]> = {};
    for (const [lang, subs] of Object.entries(translations)) {
      translationsToStore[lang] = toStoredSubtitle(subs);
    }

    const multiLangData: MultiLangStoredData = {
      currentLang,
      originalLang,
      translations: translationsToStore,
    };

    if (Object.keys(translationsToStore).length > 0) {
      items[subtitleStorageKey] = multiLangData;
      order = order.filter((key) => key !== subtitleStorageKey);
      order.push(subtitleStorageKey);
    } else {
      delete items[subtitleStorageKey];
      order = order.filter((key) => key !== subtitleStorageKey);
    }

    while (order.length > MAX_LOCAL_SUBTITLE_FILES) {
      const removed = order.shift();
      if (removed) {
        delete items[removed];
      }
    }

    if (order.length) {
      window.localStorage.setItem(
        LOCAL_SUBTITLE_KEY,
        JSON.stringify({ items, order })
      );
    } else {
      window.localStorage.removeItem(LOCAL_SUBTITLE_KEY);
    }
  }, [
    shouldPersistLocal,
    subtitleStorageKey,
    translations,
    currentLang,
    originalLang,
  ]);

  const getStoredSubtitle = useCallback((): MultiLangStoredData | null => {
    if (!shouldPersistLocal) return null;
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LOCAL_SUBTITLE_KEY);
    const state = parseSubtitleRecord(raw);
    const items = { ...state.items };
    let order = state.order.filter((key) => key in items);
    let stored = items[subtitleStorageKey];

    // Handle default storage key migration
    if (
      (!stored || (Array.isArray(stored) && !stored.length)) &&
      items[DEFAULT_STORAGE_KEY]
    ) {
      stored = items[DEFAULT_STORAGE_KEY];
      delete items[DEFAULT_STORAGE_KEY];
      items[subtitleStorageKey] = stored;
      order = order.filter(
        (key) => key !== subtitleStorageKey && key !== DEFAULT_STORAGE_KEY
      );
      order.push(subtitleStorageKey);
      while (order.length > MAX_LOCAL_SUBTITLE_FILES) {
        const removed = order.shift();
        if (removed) {
          delete items[removed];
        }
      }
      window.localStorage.setItem(
        LOCAL_SUBTITLE_KEY,
        JSON.stringify({ items, order })
      );
    }

    if (!stored) return null;

    // Check if it's old format (array) or new format (MultiLangStoredData)
    if (Array.isArray(stored)) {
      // Old format: migrate to new format
      const migratedData: MultiLangStoredData = {
        currentLang: DEFAULT_LANG,
        originalLang: DEFAULT_LANG,
        translations: {
          [DEFAULT_LANG]: stored,
        },
      };
      return migratedData;
    }

    // New format
    return stored as MultiLangStoredData;
  }, [shouldPersistLocal, subtitleStorageKey]);

  const setSubtitle = useCallback(
    (newSubtitle: Sub[], saveToHistory = true) => {
      const currentSubtitle = translations[currentLang] || [];
      if (!isEqual(newSubtitle, currentSubtitle)) {
        if (saveToHistory) {
          if (subtitleHistory.current.length >= 1000) {
            subtitleHistory.current.shift();
          }
          subtitleHistory.current.push(copySubs());
        }
        // Update translations for current language
        setTranslations((prev) => ({
          ...prev,
          [currentLang]: newSubtitle,
        }));
      }
    },
    [translations, currentLang, copySubs]
  );

  const undoSubs = useCallback(() => {
    const subs = subtitleHistory.current.pop();
    if (subs) {
      setSubtitle(subs, false);
    }
  }, [setSubtitle]);

  const clearSubs = useCallback(() => {
    setSubtitle([]);
    subtitleHistory.current.length = 0;
  }, [setSubtitle]);

  const checkSub = useCallback(
    (sub: Sub) => {
      const index = hasSub(sub);
      if (index < 0) return false;
      const previous = subtitle[index - 1];
      return Boolean(
        (previous && sub.startTime < previous.endTime) ||
          !sub.check ||
          sub.duration < 0.2
      );
    },
    [subtitle, hasSub]
  );

  const notify = useCallback(
    ({
      message,
      level,
    }: {
      message: string;
      level: "success" | "error" | "info" | "warning";
    }) => {
      switch (level) {
        case "success":
          success(message);
          break;
        case "error":
          error(message);
          break;
        case "warning":
          warning(message);
          break;
        default:
          info(message);
          break;
      }
    },
    [success, error, info, warning]
  );

  const removeSub = useCallback(
    (sub: Sub) => {
      const index = hasSub(sub);
      if (index < 0) return;
      const subs = copySubs();
      subs.splice(index, 1);
      setSubtitle(subs);
    },
    [hasSub, copySubs, setSubtitle]
  );

  const addSub = useCallback(
    (index: number, sub: SubPayload | Sub) => {
      const subs = copySubs();
      const nextSub =
        sub instanceof Sub ? sub.clone : newSub(sub as SubPayload);
      subs.splice(index, 0, nextSub);
      setSubtitle(subs);
    },
    [copySubs, setSubtitle, newSub]
  );

  const updateSub = useCallback(
    (sub: Sub, obj: Partial<SubPayload>) => {
      const index = hasSub(sub);
      if (index < 0) return;
      const subs = copySubs();
      const subClone = newSub({ ...sub, ...obj });
      if (subClone.check) {
        subs[index] = subClone;
        setSubtitle(subs);
      }
    },
    [hasSub, copySubs, setSubtitle, newSub]
  );

  const mergeSub = useCallback(
    (sub: Sub) => {
      const index = hasSub(sub);
      if (index < 0) return;
      const subs = copySubs();
      const next = subs[index + 1];
      if (!next) return;
      subs[index] = newSub({
        start: sub.start,
        end: next.end,
        text: `${sub.text.trim()}\n${next.text.trim()}`,
      });
      subs.splice(index + 1, 1);
      setSubtitle(subs);
    },
    [hasSub, copySubs, setSubtitle, newSub]
  );

  const splitSub = useCallback(
    (sub: Sub, start: number) => {
      const index = hasSub(sub);
      if (index < 0 || !sub.text || !start) return;
      const subs = copySubs();
      const text1 = sub.text.slice(0, start).trim();
      const text2 = sub.text.slice(start).trim();
      if (!text1 || !text2) return;
      const splitDuration = Number(
        (sub.duration * (start / sub.text.length)).toFixed(3)
      );
      if (splitDuration < 0.2 || sub.duration - splitDuration < 0.2) return;
      subs.splice(index, 1);
      const middleTime = DT.d2t(sub.startTime + splitDuration);
      subs.splice(
        index,
        0,
        newSub({
          start: sub.start,
          end: middleTime,
          text: text1,
        })
      );
      subs.splice(
        index + 1,
        0,
        newSub({
          start: middleTime,
          end: sub.end,
          text: text2,
        })
      );
      setSubtitle(subs);
    },
    [hasSub, copySubs, setSubtitle, newSub]
  );

  const loadSubtitleFromSource = useCallback(async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to load subtitle");
    }
    const fileName = getFileNameFromPath(url) || "subtitle";
    const ext = getExt(fileName) || "srt";
    if (ext === "json") {
      const payload = (await response.json()) as SubPayload[];
      return payload.map((item) => new Sub(item));
    }
    const blob = await response.blob();
    const normalizedName = fileName.includes(".")
      ? fileName
      : `${fileName}.${ext}`;
    const file = new File([blob], normalizedName, {
      type: blob.type || "text/plain",
    });
    return file2sub(file);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.keyCode) {
        case 32:
          event.preventDefault();
          if (player) {
            if (playing) {
              player.pause();
            } else {
              player.play();
            }
          }
          break;
        case 90:
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            undoSubs();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [player, playing, undoSubs]);

  useEffect(() => {
    const nextIndex = subtitle.findIndex(
      (item) => item.startTime <= currentTime && item.endTime > currentTime
    );
    setCurrentIndex(nextIndex);
  }, [currentTime, subtitle]);

  useEffect(() => {
    let cancelled = false;

    const loadSubtitle = async () => {
      const stored = getStoredSubtitle();
      if (stored && Object.keys(stored.translations).length > 0) {
        // Load from storage
        subtitleHistory.current.length = 0;
        if (!cancelled) {
          // Convert stored subtitles to Sub objects
          const loadedTranslations: Record<string, Sub[]> = {};
          for (const [lang, subs] of Object.entries(stored.translations)) {
            loadedTranslations[lang] = subs.map((item) => new Sub(item));
          }
          setTranslations(loadedTranslations);
          setOriginalLang(stored.originalLang);
          setCurrentLang(stored.currentLang || stored.originalLang);
        }
        return;
      }

      // Check if we have multi-language URLs
      if (subtitleUrls && Object.keys(subtitleUrls).length > 0) {
        setLoading("Loading subtitle...");
        try {
          const loadedTranslations: Record<string, Sub[]> = {};
          const languageKeys = Object.keys(subtitleUrls);

          // Load all subtitle files
          for (const lang of languageKeys) {
            try {
              const subs = await loadSubtitleFromSource(subtitleUrls[lang]);
              if (subs.length > 0) {
                loadedTranslations[lang] = subs;
              }
            } catch (error) {
              console.error(
                `Failed to load subtitle for language: ${lang}`,
                error
              );
              // Continue loading other languages even if one fails
            }
          }

          if (!cancelled && Object.keys(loadedTranslations).length > 0) {
            subtitleHistory.current.length = 0;

            // Set original language: prefer 'en', otherwise use first available
            const originalLanguage =
              "en" in loadedTranslations ? "en" : languageKeys[0];

            setTranslations(loadedTranslations);
            setOriginalLang(originalLanguage);
            setCurrentLang(originalLanguage);
          } else if (!cancelled) {
            throw new Error("No subtitles loaded");
          }
        } catch (error) {
          if (!cancelled) {
            notify({ message: "Failed to load subtitle", level: "error" });
          }
        } finally {
          if (!cancelled) {
            setLoading("");
          }
        }
        return;
      }

      // Fallback to single subtitle URL (legacy support)
      setLoading("Loading subtitle...");
      try {
        const remoteSubs = await loadSubtitleFromSource(resolvedSubtitleUrl);
        if (!remoteSubs.length) {
          throw new Error("empty subtitle");
        }
        if (!cancelled) {
          subtitleHistory.current.length = 0;
          // Initialize with default language
          setOriginalLang(DEFAULT_LANG);
          setCurrentLang(DEFAULT_LANG);
          setTranslations({
            [DEFAULT_LANG]: remoteSubs,
          });
        }
      } catch (error) {
        if (!cancelled) {
          notify({ message: "Failed to load subtitle", level: "error" });
        }
        try {
          const fallbackSubs = await loadSubtitleFromSource(
            SAMPLE_SUBTITLE_URL
          );
          if (!cancelled && fallbackSubs.length) {
            subtitleHistory.current.length = 0;
            setOriginalLang(DEFAULT_LANG);
            setCurrentLang(DEFAULT_LANG);
            setTranslations({
              [DEFAULT_LANG]: fallbackSubs,
            });
            return;
          }
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) {
          setLoading("");
        }
      }
    };

    loadSubtitle();

    return () => {
      cancelled = true;
    };
  }, [
    getStoredSubtitle,
    loadSubtitleFromSource,
    resolvedSubtitleUrl,
    subtitleUrls,
    notify,
  ]);

  // Auto persist when translations change
  useEffect(() => {
    if (Object.keys(translations).length > 0) {
      persistSubtitle();
    }
  }, [translations, persistSubtitle]);

  const sharedProps: SubtitleEditorShared = {
    player,
    setPlayer,
    subtitle,
    setSubtitle,
    waveform,
    setWaveform,
    currentTime,
    setCurrentTime,
    currentIndex,
    setCurrentIndex,
    playing,
    setPlaying,
    loading,
    setLoading,
    processing,
    setProcessing,
    language,
    setLanguage,
    videoUrl: videoSource,
    setVideoUrl: setVideoSource,
    notify,
    newSub,
    hasSub,
    checkSub,
    removeSub,
    addSub,
    undoSubs,
    clearSubs,
    updateSub,
    formatSub,
    mergeSub,
    splitSub,
    // Multi-language support
    currentLang,
    originalLang,
    translations,
    translatedLangs,
    switchLanguage,
    removeLanguage,
    addTranslation,
  };

  return (
    <div
      className={`flex fixed z-[100] top-0 left-0 w-screen h-screen flex-col gap-4 rounded-xl border border-white/5 bg-[#0B0D13] p-4 text-white ${
        className || ""
      }`}
    >
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="flex-1 min-w-0 rounded-xl border border-white/5 bg-black/30 p-4">
          <PlayerPanel {...sharedProps} />
        </div>
        <div className="w-64 min-w-[16rem] rounded-xl border border-white/5 bg-black/30 p-3">
          <SubtitleList {...sharedProps} />
        </div>
        <div className="w-72 min-w-[18rem] rounded-xl border border-white/5 bg-black/30 p-3">
          <ToolPanel {...sharedProps} />
        </div>
      </div>
      <div className="h-64 min-h-[16rem] rounded-xl border border-white/5 bg-black/40 p-3">
        <FooterPanel {...sharedProps} />
      </div>

      {loading ? (
        <Loading variant="overlay" text={loading || "Loading..."} />
      ) : null}
      {processing > 0 && processing < 100 ? (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-black/60">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-yellow-200 transition-[width]"
            style={{ width: `${processing}%` }}
          />
          <span className="absolute right-4 top-2 text-xs text-white">
            {processing.toFixed(2)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function SubtitleEditor(props: SubtitleEditorProps) {
  return (
    <ToastProvider>
      <SubtitleEditorInner {...props} />
    </ToastProvider>
  );
}

export { SubtitleEditor };
