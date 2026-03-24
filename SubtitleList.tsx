import { useMemo } from 'react';
import { Table, AutoSizer } from 'react-virtualized';
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
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl shadow-inner">
      {/* Language Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
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

      <div className="flex-1 overflow-hidden">
        <AutoSizer>
          {({ width, height }) => (
            <Table
              headerHeight={0}
              width={width}
              height={height}
              rowHeight={60}
              className="subtitle-list-table"
              headerClassName="header-row"
              rowClassName="subtitle-row"
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
                    className="text-white"
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
                    <div className="p-2">
                      <textarea
                        maxLength={400}
                        spellCheck={false}
                        className={`h-full w-full resize-none rounded-lg border px-3 py-2 text-xs leading-tight outline-none ${
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
          )}
        </AutoSizer>
      </div>
    </div>
  );
}
