export default function ass2vtt(ass: string): string {
  const reAss = new RegExp(
    'Dialogue:\\s\\d,' +
      '(\\d+:\\d\\d:\\d\\d.\\d\\d),' +
      '(\\d+:\\d\\d:\\d\\d.\\d\\d),' +
      '([^,]*),' +
      '([^,]*),' +
      '(?:[^,]*,){4}' +
      '([\\s\\S]*)$',
    'i',
  );

  function fixTime(time = ''): string {
    return time
      .split(/[:.]/)
      .map((item, index, arr) => {
        if (index === arr.length - 1) {
          if (item.length === 1) {
            return '.' + item + '00';
          }
          if (item.length === 2) {
            return '.' + item + '0';
          }
        } else if (item.length === 1) {
          return (index === 0 ? '0' : ':0') + item;
        }

        return index === 0 ? item : index === arr.length - 1 ? '.' + item : ':' + item;
      })
      .join('');
  }

  return (
    'WEBVTT\n\n' +
    ass
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(reAss);
        if (!match) return null;
        return {
          start: fixTime(match[1].trim()),
          end: fixTime(match[2].trim()),
          text: match[5]
            .replace(/{[\s\S]*?}/g, '')
            .replace(/(\\N)/g, '\n')
            .trim()
            .split(/\r?\n/)
            .map((item) => item.trim())
            .join('\n'),
        };
      })
      .filter(Boolean)
      .map((line, index) => (line ? `${index + 1}\n${line.start} --> ${line.end}\n${line.text}` : ''))
      .filter((line) => line.trim())
      .join('\n\n')
  );
}
