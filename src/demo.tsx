import React from 'react';
import ReactDOM from 'react-dom/client';
// Import from the local source (dev mode uses source, users use dist)
import { SubtitleEditor } from '@lilsnake/subtitle-editor';
import '../index.css';
import './demo.css';

// Sample subtitle data for demo
const SAMPLE_SUBTITLE_JSON = {
  subtitles: [
    { start: '00:00:00,000', end: '00:00:02,000', text: 'Welcome to the Subtitle Editor Demo!' },
    { start: '00:00:02,000', end: '00:00:04,000', text: 'This is a powerful React component' },
    { start: '00:00:04,000', end: '00:00:06,000', text: 'for editing video subtitles.' },
    { start: '00:00:06,000', end: '00:00:08,000', text: 'You can edit text, adjust timing,' },
    { start: '00:00:08,000', end: '00:00:10,000', text: 'and visualize the audio waveform.' },
    { start: '00:00:10,000', end: '00:00:12,000', text: 'Try the keyboard shortcuts:' },
    { start: '00:00:12,000', end: '00:00:14,000', text: 'Space - Play/Pause' },
    { start: '00:00:14,000', end: '00:00:16,000', text: 'Ctrl+Z - Undo' },
    { start: '00:00:16,000', end: '00:00:18,000', text: 'Enjoy editing!' },
  ]
};

// Create a blob URL for the sample subtitle
const subtitleBlob = new Blob([JSON.stringify(SAMPLE_SUBTITLE_JSON)], { type: 'application/json' });
const subtitleUrl = URL.createObjectURL(subtitleBlob);

// Public sample videos
const VIDEO_SOURCES = {
  sample: {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    subtitle: subtitleUrl,
  },
  bigbuckbunny: {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    subtitle: subtitleUrl,
  },
  sintel: {
    video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    subtitle: subtitleUrl,
  },
};

function Demo() {
  const [currentVideo, setCurrentVideo] = React.useState<string>('sample');

  return (
    <div className="demo-app">
      <SubtitleEditor
        videoUrl={VIDEO_SOURCES[currentVideo as keyof typeof VIDEO_SOURCES].video}
        subtitleUrl={VIDEO_SOURCES[currentVideo as keyof typeof VIDEO_SOURCES].subtitle}
        initialLanguage="en"
        persistToLocal={true}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>
);
