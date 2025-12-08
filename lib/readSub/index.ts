import DT from 'duration-time-conversion';
import Sub from '../Sub';
import { getExt } from '../../utils';
import ass2vtt from './ass2vtt';
import srt2vtt from './srt2vtt';
import sub2ass from './sub2ass';

export function url2sub(url: string): Promise<Sub[]> {
  return new Promise((resolve) => {
    const $video = document.createElement('video');
    const $track = document.createElement('track');
    $track.default = true;
    $track.kind = 'metadata';
    $video.appendChild($track);
    $track.onload = () => {
      const cues = Array.from($track.track?.cues || []) as Array<TextTrackCue & { text?: string }>;
      resolve(
        cues.map((item) => {
          const start = DT.d2t(item.startTime);
          const end = DT.d2t(item.endTime);
          const text = item.text || '';
          return new Sub({ start, end, text });
        }),
      );
    };
    $track.src = url;
  });
}

export function vtt2url(vtt: string): string {
  return URL.createObjectURL(
    new Blob([vtt], {
      type: 'text/vtt',
    }),
  );
}

export function file2sub(file: File): Promise<Sub[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        resolve([]);
        return;
      }
      const ext = getExt(file.name);
      if (ext === 'json') {
        try {
          const sub = JSON.parse(reader.result).map((item: Sub) => new Sub(item));
          resolve(sub);
        } catch (error) {
          reject(error);
        }
        return;
      }
      const text = reader.result.replace(/{[\s\S]*?}/g, '');
      switch (ext) {
        case 'vtt': {
          const url = vtt2url(text);
          const sub = await url2sub(url);
          resolve(sub);
          break;
        }
        case 'ass': {
          const vtt = ass2vtt(text);
          const url = vtt2url(vtt);
          const sub = await url2sub(url);
          resolve(sub);
          break;
        }
        case 'srt':
        case 'txt':
        case 'raw': {
          const vtt = srt2vtt(text);
          const url = vtt2url(vtt);
          const sub = await url2sub(url);
          resolve(sub);
          break;
        }
        case 'json': {
          const sub = JSON.parse(text).map((item: Sub) => new Sub(item));
          resolve(sub);
          break;
        }
        default:
          resolve([]);
          break;
      }
    };
    reader.onerror = (event) => reject(event);
    reader.readAsText(file);
  });
}

export function sub2vtt(sub: Sub[]): string {
  return (
    'WEBVTT\n\n' +
    sub
      .map((item, index) => {
        return `${index + 1}\n${item.start} --> ${item.end}\n${item.text}`;
      })
      .join('\n\n')
  );
}

export function sub2srt(sub: Sub[]): string {
  return sub
    .map((item, index) => {
      return `${index + 1}\n${item.start.replace('.', ',')} --> ${item.end.replace('.', ',')}\n${item.text}`;
    })
    .join('\n\n');
}

export function sub2txt(sub: Sub[]): string {
  return sub.map((item) => item.text).join('\n\n');
}

export { sub2ass };
