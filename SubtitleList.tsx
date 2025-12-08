import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table } from 'react-virtualized';
import debounce from 'lodash/debounce';
import unescape from 'lodash/unescape';
import type Sub from './lib/Sub';
import type { SubtitleEditorShared } from './types';
import languages from './lib/languages';
import 'react-virtualized/styles.css';

export default function SubtitleList({
  currentIndex,
  subtitle,
  checkSub,
  player,
  updateSub,
  currentLang,
  originalLang,
  language,
}: SubtitleEditorShared) {
  const [height, setHeight] = useState(300);

  const resize = useCallback(() => {
    setHeight(Math.max(200, document.body.clientHeight - 220));
  }, []);

  useEffect(() => {
    resize();
    const debounceResize = debounce(resize, 300);
    window.addEventListener('resize', debounceResize);
    return () => window.removeEventListener('resize', debounceResize);
  }, [resize]);

  const normalizedLanguage = language.toLowerCase().startsWith("zh") ? "zh" : "en";
  const languageOptions = useMemo(
    () => languages[normalizedLanguage] || languages.en,
    [normalizedLanguage]
  );

  const currentLanguageName = useMemo(() => {
    const lang = languageOptions.find((item) => item.key === currentLang);
    return lang?.name || currentLang;
  }, [currentLang, languageOptions]);

  const isOriginal = currentLang === originalLang;

  return (
    <div className="h-full w-full overflow-hidden rounded-xl shadow-inner">
      {/* Language Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 mb-2">
        <div className="text-xs font-medium text-white">
          {currentLanguageName}
          {isOriginal && (
            <span className="ml-2 text-xs font-normal text-sky-400">
              (原始)
            </span>
          )}
        </div>
        <div className="text-xs text-white/60">
          {subtitle.length} 条
        </div>
      </div>

      <Table
        headerHeight={10}
        width={256}
        height={height}
        rowHeight={60}
        className=''
        containerStyle={{
          // marginRight: '10px'
        }}
        scrollToIndex={currentIndex}
        rowCount={subtitle.length}
        rowGetter={({ index }) => subtitle[index]}
        rowRenderer={(props) => {
          const sub = props.rowData as Sub;
          const isActive = currentIndex === props.index;
          const isIllegal = checkSub(sub);
          return (
            <div
              key={props.key}
              className="   text-white"
              style={props.style}
              onClick={() => {
                if (player) {
                  player.pause();
                  if (player.duration >= sub.startTime) {
                    player.currentTime = sub.startTime + 0.001;
                  }
                }
              }}
            >
              <div className=" p-2">
                <textarea
                  maxLength={400}
                  spellCheck={false}
                  className={`h-full w-[240px] !p-3 resize-none rounded-lg border px-3 py-2 text-xs leading-tight outline-none ${
                    isActive
                      ? 'border-sky-400 bg-sky-600/30'
                      : isIllegal
                        ? 'border-amber-400 bg-amber-600/40'
                        : 'border-white/10 bg-white/5'
                  }`}
                  value={unescape(sub.text)}
                  onChange={(event) =>
                    updateSub(sub, {
                      text: event.target.value,
                    })
                  }
                />
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
