import { sleep } from '../utils';
import Sub from './Sub';

export interface BatchTranslateProgress {
  lang: string;
  progress: number;
  status: 'pending' | 'translating' | 'success' | 'error';
  error?: string;
}

export interface BatchTranslateResult {
  success: Record<string, Sub[]>;
  failed: Record<string, string>;  // lang -> error message
}

export interface BatchTranslateOptions {
  onProgress?: (progress: BatchTranslateProgress) => void;
  onLangComplete?: (lang: string, subs: Sub[]) => void;
  concurrentLimit?: number;  // 限制并发数
}

/**
 * 批量翻译字幕到多个语言
 * @param subtitle 原始字幕
 * @param targetLangs 目标语言列表
 * @param options 选项
 * @returns 翻译结果
 */
export default async function batchTranslate(
  subtitle: Sub[],
  targetLangs: string[],
  options: BatchTranslateOptions = {}
): Promise<BatchTranslateResult> {
  const {
    onProgress,
    onLangComplete,
    concurrentLimit = 2,  // 默认同时翻译2个语言，避免 API 限流
  } = options;

  const result: BatchTranslateResult = {
    success: {},
    failed: {},
  };

  // 初始化所有语言的状态为 pending
  targetLangs.forEach((lang) => {
    onProgress?.({
      lang,
      progress: 0,
      status: 'pending',
    });
  });

  // 创建翻译任务队列
  const queue = [...targetLangs];
  const activeTasks = new Set<Promise<void>>();

  while (queue.length > 0 || activeTasks.size > 0) {
    // 启动新任务，直到达到并发限制
    while (queue.length > 0 && activeTasks.size < concurrentLimit) {
      const lang = queue.shift();
      if (!lang) break;

      const task = translateSingleLanguage(
        subtitle,
        lang,
        onProgress
      ).then((subs) => {
        result.success[lang] = subs;
        onProgress?.({
          lang,
          progress: 100,
          status: 'success',
        });
        onLangComplete?.(lang, subs);
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed[lang] = errorMessage;
        onProgress?.({
          lang,
          progress: 0,
          status: 'error',
          error: errorMessage,
        });
      }).finally(() => {
        activeTasks.delete(task);
      });

      activeTasks.add(task);
    }

    // 等待至少一个任务完成
    if (activeTasks.size > 0) {
      await Promise.race(Array.from(activeTasks));
    }
  }

  return result;
}

/**
 * 翻译单个语言
 * @param subtitle 原始字幕
 * @param targetLang 目标语言
 * @param onProgress 进度回调
 * @returns 翻译后的字幕
 */
async function translateSingleLanguage(
  subtitle: Sub[],
  targetLang: string,
  onProgress?: (progress: BatchTranslateProgress) => void
): Promise<Sub[]> {
  onProgress?.({
    lang: targetLang,
    progress: 0,
    status: 'translating',
  });

  // 使用现有的 googleTranslate 函数
  // 但需要跟踪进度
  const totalItems = subtitle.length;
  let completedItems = 0;

  // 克隆字幕，保留时间轴
  const queue = subtitle.map((item) => item.clone);
  const result: Sub[] = [];

  return new Promise((resolve, reject) => {
    (function loop() {
      const item = queue.shift();
      if (item) {
        translate(item.text, targetLang)
          .then((text) => {
            item.text = text;
            result.push(item);
            completedItems++;

            // 更新进度
            const progress = Math.floor((completedItems / totalItems) * 100);
            onProgress?.({
              lang: targetLang,
              progress,
              status: 'translating',
            });

            sleep(100).then(loop);
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        resolve(result);
      }
    })();
  });
}

/**
 * 翻译单个文本
 * @param query 待翻译的文本
 * @param lang 目标语言
 * @returns 翻译后的文本
 */
async function translate(query: string, lang: string): Promise<string> {
  if (!query.trim()) return '';
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.append('client', 'gtx');
  url.searchParams.append('sl', 'auto');
  url.searchParams.append('dt', 't');
  url.searchParams.append('tl', lang);
  url.searchParams.append('q', query);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Translate request failed');
  }
  const data = await response.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return '';
  }
  return data[0]
    .map((item: unknown) => {
      if (Array.isArray(item) && typeof item[0] === 'string') {
        return item[0].trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}
