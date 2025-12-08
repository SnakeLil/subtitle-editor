import JSZip from 'jszip';
import Sub from '../lib/Sub';
import { sub2ass, sub2srt, sub2vtt } from '../lib/readSub';
import { download } from '../utils';

export type ExportFormat = 'ass' | 'srt' | 'vtt';

/**
 * 将字幕转换为指定格式的文本
 * @param subtitle 字幕数据
 * @param format 导出格式
 * @returns 文本内容
 */
export function subtitleToText(subtitle: Sub[], format: ExportFormat): string {
  switch (format) {
    case 'ass':
      return sub2ass(subtitle);
    case 'srt':
      return sub2srt(subtitle);
    case 'vtt':
      return sub2vtt(subtitle);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * 批量导出所有语言的字幕到 ZIP 文件
 * @param translations 所有语言的字幕数据
 * @param format 导出格式
 * @param baseFileName 基础文件名（不含扩展名）
 * @returns Promise
 */
export async function batchExportSubtitles(
  translations: Record<string, Sub[]>,
  format: ExportFormat,
  baseFileName: string = 'subtitle'
): Promise<void> {
  const zip = new JSZip();

  // 遍历所有语言，添加到 ZIP
  for (const [lang, subs] of Object.entries(translations)) {
    if (!subs || subs.length === 0) continue;

    const text = subtitleToText(subs, format);
    const fileName = `${baseFileName}_${lang}.${format}`;
    zip.file(fileName, text);
  }

  // 生成 ZIP 文件
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const zipFileName = `${baseFileName}_all.zip`;

  download(url, zipFileName);

  // 清理 URL
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 批量导出所有语言的字幕（不压缩，逐个下载）
 * @param translations 所有语言的字幕数据
 * @param format 导出格式
 * @param baseFileName 基础文件名（不含扩展名）
 * @param delay 每个文件下载之间的延迟（毫秒）
 */
export async function batchExportSubtitlesSequential(
  translations: Record<string, Sub[]>,
  format: ExportFormat,
  baseFileName: string = 'subtitle',
  delay: number = 500
): Promise<void> {
  const langs = Object.keys(translations);

  for (let i = 0; i < langs.length; i++) {
    const lang = langs[i];
    const subs = translations[lang];

    if (!subs || subs.length === 0) continue;

    const text = subtitleToText(subs, format);
    const fileName = `${baseFileName}_${lang}.${format}`;
    const url = URL.createObjectURL(new Blob([text]));

    download(url, fileName);

    // 清理 URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

    // 延迟，避免浏览器阻止多个下载
    if (i < langs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * 导出单个语言的字幕
 * @param subtitle 字幕数据
 * @param format 导出格式
 * @param fileName 文件名（不含扩展名）
 */
export function exportSingleSubtitle(
  subtitle: Sub[],
  format: ExportFormat,
  fileName: string = 'subtitle'
): void {
  const text = subtitleToText(subtitle, format);
  const fullFileName = `${fileName}.${format}`;
  const url = URL.createObjectURL(new Blob([text]));

  download(url, fullFileName);

  // 清理 URL
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
