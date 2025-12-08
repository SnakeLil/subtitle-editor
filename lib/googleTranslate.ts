import { sleep } from '../utils';
import Sub from './Sub';

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

export default function googleTranslate(subtitle: Sub[], lang: string): Promise<Sub[]> {
  const queue = subtitle.map((item) => item.clone);
  const result: Sub[] = [];

  return new Promise((resolve, reject) => {
    (function loop() {
      const item = queue.shift();
      if (item) {
        translate(item.text, lang)
          .then((text) => {
            item.text = text;
            result.push(item);
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
