import type WFPlayer from 'wfplayer';
import type Sub from './lib/Sub';
import type { SubPayload } from './lib/Sub';

export type SubtitleList = Sub[];
export type SubtitlePrimitive = SubPayload;

export interface NotificationPayload {
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

export interface RenderState {
  padding: number;
  duration: number;
  gridGap: number;
  gridNum: number;
  beginTime: number;
}

// Multi-language subtitle data structures
export interface MultiLangSubtitleData {
  currentLang: string;              // 当前编辑的语言代码
  originalLang: string;             // 原始语言代码（初次加载的语言）
  translations: Record<string, Sub[]>;  // 语言代码 -> 字幕数据（包括原始语言）
}

export interface MultiLangStoredData {
  currentLang: string;
  originalLang: string;
  translations: Record<string, SubPayload[]>;  // 所有语言的字幕
}

export interface SubtitleEditorShared {
  player: HTMLVideoElement | null;
  setPlayer: (player: HTMLVideoElement | null) => void;
  subtitle: SubtitleList;
  setSubtitle: (subs: SubtitleList, saveToHistory?: boolean) => void;
  waveform: WFPlayer | null;
  setWaveform: (waveform: WFPlayer | null) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  videoUrl: string;
  setVideoUrl: (url: string) => void;
  loading: string;
  setLoading: (text: string) => void;
  processing: number;
  setProcessing: (value: number) => void;
  language: string;
  setLanguage: (lang: string) => void;

  // Multi-language support
  currentLang: string;
  originalLang: string;
  translations: Record<string, Sub[]>;
  translatedLangs: string[];
  switchLanguage: (lang: string) => void;
  removeLanguage: (lang: string) => void;
  addTranslation: (lang: string, subs: Sub[]) => void;

  notify: (payload: NotificationPayload) => void;
  newSub: (payload: SubtitlePrimitive) => Sub;
  hasSub: (sub: Sub) => number;
  checkSub: (sub: Sub) => boolean;
  removeSub: (sub: Sub) => void;
  addSub: (index: number, sub: SubtitlePrimitive | Sub) => void;
  undoSubs: () => void;
  clearSubs: () => void;
  updateSub: (sub: Sub, obj: Partial<SubtitlePrimitive>) => void;
  formatSub: (sub: SubtitlePrimitive | Sub | Array<SubtitlePrimitive | Sub>) => Sub | Sub[];
  mergeSub: (sub: Sub) => void;
  splitSub: (sub: Sub, cursor: number) => void;
}

export interface SubtitleEditorProps {
  initialLanguage?: string;
  className?: string;
  subtitleUrl?: string;  // Single subtitle URL (legacy support)
  subtitleUrls?: Record<string, string>;  // Multi-language URLs: { en: 'url', zh: 'url' }
  videoUrl?: string;
  persistToLocal?: boolean;
  filmId?: string;  // For business logic integration
}
