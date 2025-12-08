import { useCallback, useMemo, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import SimpleFS from "@forlagshuset/simple-fs";
import {
  Box,
  Tabs,
  Tab,
  Button,
  Chip,
  IconButton,
  Checkbox,
  Tooltip,
  Typography,
  Stack,
  Card,
  CardContent,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import {
  Upload as UploadIcon,
  Translate as TranslateIcon,
  Download as DownloadIcon,
  Build as BuildIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Language as LanguageIcon,
  VideoFile as VideoFileIcon,
  Subtitles as SubtitlesIcon,
  Archive as ArchiveIcon,
  Undo as UndoIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import languages from "./lib/languages";
import batchTranslate, { type BatchTranslateProgress } from "./lib/batchTranslate";
import { batchExportSubtitles } from "./utils/batchExport";
import BatchTranslateProgressDialog from "./BatchTranslateProgress";
import { download, getExt, getFileNameFromPath } from "./utils";
import { file2sub, sub2ass, sub2srt, sub2txt, sub2vtt } from "./lib/readSub";
import { SAMPLE_VIDEO_URL } from "./constants";
import type { SubtitleEditorShared } from "./types";
import type Sub from "./lib/Sub";
import type { SelectChangeEvent } from "@mui/material/Select";

type ProgressPayload = { progress: number };

const fsInstance = new SimpleFS.FileSystem();


const MENU_ITEM_HEIGHT = 48;
const MENU_ITEM_PADDING_TOP = 8;
const LANGUAGE_MENU_PROPS = {
  PaperProps: {
    style: {
      maxHeight: MENU_ITEM_HEIGHT * 5.5 + MENU_ITEM_PADDING_TOP,
      width: 320,
    },
  },
};

const LANGUAGE_SELECT_LABEL_ID = "translate-language-selector";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ height: "100%", overflow: "auto" }}
    >
      {value === index && <Box sx={{ p: 2, height: "100%" }}>{children}</Box>}
    </div>
  );
}

export default function ToolPanel(props: SubtitleEditorShared) {
  const {
    player,
    waveform,
    newSub,
    undoSubs,
    clearSubs,
    language,
    subtitle,
    setLoading,
    formatSub,
    setSubtitle,
    setProcessing,
    notify,
    videoUrl,
    setVideoUrl,
    // Multi-language
    currentLang,
    originalLang,
    translations,
    translatedLangs,
    switchLanguage,
    removeLanguage,
    addTranslation,
  } = props;

  const selectLabelText = "Select target languages";
  const commonLanguagesLabel = "Common Languages";
  const moreLanguagesLabel = "More Languages";
  const noAvailableLanguagesText = "All available languages have been translated";
  const [activeTab, setActiveTab] = useState<number>(0);
  const [translateLang, setTranslateLang] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [translateProgressMap, setTranslateProgressMap] = useState<Record<string, BatchTranslateProgress>>({});
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const normalizedLanguage = language.toLowerCase().startsWith("zh") ? "zh" : "en";
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const getFFmpeg = useCallback(async () => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    if (!ffmpegRef.current.loaded) {
      await ffmpegRef.current.load();
    }
    return ffmpegRef.current;
  }, []);

  const attachProgress = useCallback(
    (ffmpeg: FFmpeg) => {
      const handler = ({ progress }: ProgressPayload) => {
        setProcessing(progress * 100);
      };
      ffmpeg.on("progress", handler);
      return () => {
        ffmpeg.off("progress", handler);
      };
    },
    [setProcessing]
  );

  const decodeAudioData = useCallback(
    async (file: File) => {
      if (!waveform) return;
      let detachProgress: (() => void) | null = null;
      try {
        const ffmpeg = await getFFmpeg();
        detachProgress = attachProgress(ffmpeg);
        setLoading("Loading FFmpeg...");
        await ffmpeg.writeFile(file.name, await fetchFile(file));
        setLoading("");
        notify({
          message: "Decoding audio...",
          level: "info",
        });
        const output = `${Date.now()}.mp3`;
        await ffmpeg.exec(["-i", file.name, "-ac", "1", "-ar", "8000", output]);
        const uint8 = (await ffmpeg.readFile(output)) as Uint8Array;
        const decoder = waveform.decoder as unknown as {
          decodeAudioData: (data: Uint8Array) => Promise<void>;
        };
        await decoder.decodeAudioData(uint8);
        const drawer = waveform.drawer as unknown as { update?: () => void };
        drawer.update?.();
        setProcessing(0);
        notify({
          message: "Audio decoded successfully",
          level: "success",
        });
      } catch (error) {
        setLoading("");
        setProcessing(0);
        notify({
          message: "Failed to decode audio",
          level: "error",
        });
      } finally {
        detachProgress?.();
      }
    },
    [waveform, notify, setProcessing, setLoading, attachProgress, getFFmpeg]
  );

  const burnSubtitles = useCallback(async () => {
    if (!player) {
      notify({
        message: "Failed to open video",
        level: "error",
      });
      return;
    }
    let detachProgress: (() => void) | null = null;
    try {
      const ffmpeg = await getFFmpeg();
      detachProgress = attachProgress(ffmpeg);
      setLoading("Loading FFmpeg...");
      setLoading("Loading font...");
      await fsInstance.mkdir("/fonts");
      const fontExist = await fsInstance.exists("/fonts/Microsoft-YaHei.ttf");
      await ffmpeg.createDir("/tmp").catch(() => undefined);
      if (fontExist) {
        const fontBlob = await fsInstance.readFile("/fonts/Microsoft-YaHei.ttf");
        await ffmpeg.writeFile("/tmp/Microsoft-YaHei.ttf", await fetchFile(fontBlob));
      } else {
        const fontUrl =
          "https://cdn.jsdelivr.net/gh/zhw2590582/SubPlayer/docs/Microsoft-YaHei.ttf";
        const fontBlob = await fetch(fontUrl).then((res) => res.blob());
        await fsInstance.writeFile("/fonts/Microsoft-YaHei.ttf", fontBlob);
        await ffmpeg.writeFile("/tmp/Microsoft-YaHei.ttf", await fetchFile(fontBlob));
      }

      setLoading("Loading video...");
      const fallbackVideoUrl = videoUrl || SAMPLE_VIDEO_URL;
      const videoName = videoFile
        ? videoFile.name
        : getFileNameFromPath(fallbackVideoUrl) || "sample.mp4";
      const videoSource = videoFile || fallbackVideoUrl;
      await ffmpeg.writeFile(videoName, await fetchFile(videoSource));

      setLoading("Loading subtitle...");
      const subtitleFile = new File([new Blob([sub2ass(subtitle)])], "subtitle.ass");
      await ffmpeg.writeFile(subtitleFile.name, await fetchFile(subtitleFile));
      setLoading("");
      notify({
        message: "Burning subtitles...",
        level: "info",
      });
      const output = `${Date.now()}.mp4`;
      await ffmpeg.exec([
        "-i",
        videoName,
        "-vf",
        `ass=${subtitleFile.name}:fontsdir=/tmp`,
        "-preset",
        videoFile ? "fast" : "ultrafast",
        output,
      ]);
      const outputData = await ffmpeg.readFile(output);
      const fileBuffer: Uint8Array =
        outputData instanceof Uint8Array
          ? outputData
          : new TextEncoder().encode(outputData as string);
      const arrayBuffer = fileBuffer.buffer as ArrayBuffer;
      download(
        URL.createObjectURL(new Blob([arrayBuffer], { type: "video/mp4" })),
        `${output}`
      );
      setProcessing(0);
      notify({
        message: "Video exported successfully",
        level: "success",
      });
    } catch (error) {
      setLoading("");
      setProcessing(0);
      notify({
        message: "Failed to export video",
        level: "error",
      });
    } finally {
      detachProgress?.();
    }
  }, [
    notify,
    setProcessing,
    setLoading,
    videoFile,
    subtitle,
    player,
    attachProgress,
    getFFmpeg,
    videoUrl,
  ]);

  const onVideoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !player || !waveform) return;
      const ext = getExt(file.name);
      const canPlayType = player.canPlayType(file.type);
      if (canPlayType === "maybe" || canPlayType === "probably") {
        setVideoFile(file);
        decodeAudioData(file);
        const url = URL.createObjectURL(new Blob([file]));
        const decoder = waveform.decoder as unknown as { destroy?: () => void };
        decoder.destroy?.();
        const drawer = waveform.drawer as unknown as { update?: () => void };
        drawer.update?.();
        waveform.seek(0);
        player.currentTime = 0;
        clearSubs();
        setSubtitle([
          newSub({
            start: "00:00:00.000",
            end: "00:00:01.000",
            text: "Sample subtitle text",
          }),
        ]);
        player.src = url;
        setVideoUrl(url);
      } else {
        notify({
          message: `Unsupported video format: ${file.type || ext}`,
          level: "error",
        });
      }
    },
    [
      newSub,
      notify,
      player,
      setSubtitle,
      waveform,
      clearSubs,
      decodeAudioData,
      setVideoUrl,
    ]
  );

  const onSubtitleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const ext = getExt(file.name);
      if (["ass", "vtt", "srt", "json"].includes(ext)) {
        file2sub(file)
          .then((res) => {
            clearSubs();
            setSubtitle(formatSub(res) as Sub[]);
          })
          .catch((err) => {
            notify({
              message: err.message,
              level: "error",
            });
          });
      } else {
        notify({
          message: `Unsupported subtitle format: ${ext}`,
          level: "error",
        });
      }
    },
    [notify, setSubtitle, clearSubs, formatSub]
  );

  const downloadSub = useCallback(
    (type: "ass" | "srt" | "vtt" | "txt" | "json") => {
      let text = "";
      const name = `${Date.now()}.${type}`;
      switch (type) {
        case "vtt":
          text = sub2vtt(subtitle);
          break;
        case "srt":
          text = sub2srt(subtitle);
          break;
        case "ass":
          text = sub2ass(subtitle);
          break;
        case "txt":
          text = sub2txt(subtitle);
          break;
        case "json":
          text = JSON.stringify(subtitle);
          break;
        default:
          break;
      }
      const url = URL.createObjectURL(new Blob([text]));
      download(url, name);
    },
    [subtitle]
  );

  const onBatchTranslate = useCallback(async () => {
    if (translateLang.length === 0) {
      notify({
        message: "Please select at least one language",
        level: "error",
      });
      return;
    }

    setTranslateProgressMap({});
    setShowProgressDialog(true);

    try {
      const result = await batchTranslate(subtitle, translateLang, {
        onProgress: (progress: BatchTranslateProgress) => {
          setTranslateProgressMap((prev) => ({
            ...prev,
            [progress.lang]: progress,
          }));
        },
        onLangComplete: (lang: string, subs: Sub[]) => {
          addTranslation(lang, subs);
        },
      });

      const successCount = Object.keys(result.success).length;
      const failCount = Object.keys(result.failed).length;

      if (successCount > 0) {
        notify({
          message: `Translation completed: ${successCount} languages`,
          level: "success",
        });
      }

      if (failCount > 0) {
        notify({
          message: `Translation failed: ${failCount} languages`,
          level: "warning",
        });
      }

      setTranslateLang([]);
    } catch (error) {
      notify({
        message: "Translation error",
        level: "error",
      });
    }
  }, [subtitle, translateLang, notify, addTranslation]);

  const onBatchExport = useCallback(
    async (format: "ass" | "srt" | "vtt") => {
      try {
        await batchExportSubtitles(translations, format, "subtitle");
        notify({
          message: "Export successful",
          level: "success",
        });
      } catch (error) {
        notify({
          message: "Export failed",
          level: "error",
        });
      }
    },
    [translations, notify]
  );

  const languageOptions = useMemo(
    () => languages[normalizedLanguage] || languages.en,
    [normalizedLanguage]
  );

  // Filter out already translated languages
  const availableLanguages = useMemo(
    () => languageOptions.filter(lang => !translatedLangs.includes(lang.key)),
    [languageOptions, translatedLangs]
  );

  const commonLanguages = useMemo(
    () => availableLanguages.slice(0, 6),
    [availableLanguages]
  );

  const moreLanguages = useMemo(() => availableLanguages.slice(6), [availableLanguages]);

  const handleLanguageSelectionChange = useCallback(
    (event: SelectChangeEvent<string[]>) => {
      console.log(event,'event')
      const {
        target: { value },
      } = event;
      const normalizedValue = typeof value === "string" ? value.split(",") : [...value];
      setTranslateLang(normalizedValue);
    },
    [setTranslateLang]
  );

  const getLanguageName = useCallback(
    (langKey: string) => {
      const lang = languageOptions.find((item) => item.key === langKey);
      return lang?.name || langKey;
    },
    [languageOptions]
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <>
      <BatchTranslateProgressDialog
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        progressMap={translateProgressMap}
        getLanguageName={getLanguageName}
      />
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          minHeight: 48,
          "& .MuiTab-root": {
            minHeight: 48,
            fontSize: "0.875rem",
            fontWeight: 500,
          },
        }}
      >
        <Tab
          icon={<UploadIcon fontSize="small" />}
          iconPosition="start"
          label={"Import"}
        />
        <Tab
          icon={<TranslateIcon fontSize="small" />}
          iconPosition="start"
          label={"Translate"}
        />
        <Tab
          icon={<DownloadIcon fontSize="small" />}
          iconPosition="start"
          label={"Export"}
        />
        <Tab
          icon={<BuildIcon fontSize="small" />}
          iconPosition="start"
          label={"Tools"}
        />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {/* Import Tab */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={2}>
            <Button
              variant="contained"
              component="label"
              startIcon={<VideoFileIcon />}
              size="large"
              fullWidth
            >
              {"Open Video"}
              <input type="file" hidden onChange={onVideoChange} />
            </Button>

            <Button
              variant="contained"
              component="label"
              startIcon={<SubtitlesIcon />}
              size="large"
              fullWidth
            >
              {"Open Subtitle"}
              <input type="file" hidden onChange={onSubtitleChange} />
            </Button>
          </Stack>
        </TabPanel>

        {/* Translate Tab */}
        <TabPanel value={activeTab} index={1}>
          <Stack spacing={2.5}>
            {/* Current Language */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  {"Current Language"}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <LanguageIcon fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight={600}>
                    {getLanguageName(currentLang)}
                  </Typography>
                  {currentLang === originalLang && (
                    <Chip label={"Original"} size="small" color="primary" />
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Translated Languages List */}
            {translatedLangs.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    {"Translated Languages"}
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {translatedLangs.map((lang) => (
                      <Card
                        key={lang}
                        variant="outlined"
                        sx={{
                          bgcolor: lang === currentLang ? "action.selected" : "background.paper",
                        }}
                      >
                        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Typography variant="body2" fontWeight={500}>
                                {getLanguageName(lang)}
                              </Typography>
                              {lang === originalLang && (
                                <Chip
                                  label={"Original"}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {lang === currentLang && (
                                <Chip
                                  label={"Editing"}
                                  size="small"
                                  color="primary"
                                />
                              )}
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              {lang !== currentLang && (
                                <Tooltip title={"Edit"}>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => switchLanguage(lang)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {lang !== originalLang && (
                                <Tooltip title={"Delete"}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Delete this language?"
                                        )
                                      ) {
                                        removeLanguage(lang);
                                      }
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Language Selector */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  {selectLabelText}
                </Typography>
                <FormControl fullWidth sx={{ mt: 1.5 }}>
                  <InputLabel id={LANGUAGE_SELECT_LABEL_ID}>{selectLabelText}</InputLabel>
                  <Select<string[]>
                    labelId={LANGUAGE_SELECT_LABEL_ID}
                    multiple
                    value={translateLang}
                    onChange={handleLanguageSelectionChange}
                    input={<OutlinedInput label={selectLabelText} />}
                    renderValue={(selected) => {
                      const selectedValues = selected;
                      if (selectedValues.length === 0) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            {/* {selectPlaceholderText} */}
                          </Typography>
                        );
                      }
                      return (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {selectedValues.map((value) => (
                            <Chip key={value} label={getLanguageName(value)} size="small" />
                          ))}
                        </Box>
                      );
                    }}
                    MenuProps={LANGUAGE_MENU_PROPS}
                    displayEmpty
                    disabled={availableLanguages.length === 0}
                  >
                    {[
                      ...(commonLanguages.length > 0
                        ? [
                            <ListSubheader key="common-header" disableSticky>
                              {commonLanguagesLabel}
                            </ListSubheader>,
                            ...commonLanguages.map((lang) => (
                              <MenuItem key={lang.key} value={lang.key}>
                                <Checkbox
                                  checked={translateLang.includes(lang.key)}
                                  size="small"
                                />
                                <ListItemText primary={lang.name} />
                              </MenuItem>
                            )),
                          ]
                        : []),
                      ...(moreLanguages.length > 0
                        ? [
                            <ListSubheader key="more-header" disableSticky>
                              {moreLanguagesLabel}
                            </ListSubheader>,
                            ...moreLanguages.map((lang) => (
                              <MenuItem key={lang.key} value={lang.key}>
                                <Checkbox
                                  checked={translateLang.includes(lang.key)}
                                  size="small"
                                />
                                <ListItemText primary={lang.name} />
                              </MenuItem>
                            )),
                          ]
                        : []),
                    ]}
                  </Select>
                </FormControl>

                {availableLanguages.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {noAvailableLanguagesText}
                  </Typography>
                )}

                {/* Selected Count */}
                {translateLang.length > 0 && (
                  <Alert severity="info" sx={{ mt: 1.5 }}>
                    {"Selected"}: {translateLang.length}
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Batch Translate Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={translateLang.length === 0}
              onClick={onBatchTranslate}
              startIcon={<TranslateIcon />}
            >
              {"Batch Translate"}
            </Button>
          </Stack>
        </TabPanel>

        {/* Export Tab */}
        <TabPanel value={activeTab} index={2}>
          <Stack spacing={2.5}>
            {/* Export Current Language */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  {"Export Current"} ({getLanguageName(currentLang)})
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                  {(["ass", "srt", "vtt", "txt"] as const).map((type) => (
                    <Button
                      key={type}
                      variant="outlined"
                      size="medium"
                      onClick={() => downloadSub(type)}
                      sx={{ flex: "1 1 calc(50% - 4px)", minWidth: 100 }}
                    >
                      {type.toUpperCase()}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Batch Export All Languages */}
            {translatedLangs.length > 1 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    {"Batch Export"} ({translatedLangs.length} languages)
                  </Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {(["ass", "srt", "vtt"] as const).map((type) => (
                      <Button
                        key={type}
                        variant="contained"
                        size="medium"
                        fullWidth
                        onClick={() => onBatchExport(type)}
                        startIcon={<ArchiveIcon />}
                      >
                        {"Export as ZIP"} ({type.toUpperCase()})
                      </Button>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Export Video */}
            {window.crossOriginIsolated && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    {"Export Video"}
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={burnSubtitles}
                    startIcon={<VideoFileIcon />}
                    sx={{ mt: 1.5 }}
                  >
                    {"Export Video"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </Stack>
        </TabPanel>

        {/* Tools Tab */}
        <TabPanel value={activeTab} index={3}>
          <Stack spacing={2}>
            <Tooltip title={"Clear all subtitles?"}>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                startIcon={<ClearIcon />}
                onClick={() => {
                  if (window.confirm("Clear all subtitles?")) {
                    clearSubs();
                    window.location.reload();
                  }
                }}
              >
                {"Clear"}
              </Button>
            </Tooltip>

            <Tooltip title="Ctrl + Z">
              <Button
                variant="outlined"
                size="large"
                fullWidth
                startIcon={<UndoIcon />}
                onClick={undoSubs}
              >
                {"Undo"}
              </Button>
            </Tooltip>

            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={() => {
                window.open("https://zm.i8k.tv/", "");
              }}
            >
              工具箱
            </Button>

            <Divider sx={{ my: 2 }} />

            {/* Hotkeys */}
            <Typography variant="caption" color="text.secondary">
              快捷键
            </Typography>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="body2">
                  {"Space: Play/Pause"}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="body2">{"Cmd/Ctrl+Z: Undo"}</Typography>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>
      </Box>
    </Box>
    </>
  );
}
