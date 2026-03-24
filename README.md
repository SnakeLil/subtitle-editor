# Subtitle Editor

A powerful React subtitle editor component with multi-language support, waveform visualization, and real-time editing capabilities.

## Features

- 🎬 **Video Player Integration** - Seamlessly integrated video player with subtitle synchronization
- 🌊 **Waveform Visualization** - Visual audio waveform for precise timing adjustments
- 🌍 **Multi-language Support** - Edit and manage subtitles in multiple languages
- ⚡ **Real-time Editing** - Instant preview of subtitle changes
- 📝 **Multiple Formats** - Support for SRT, VTT, and ASS subtitle formats
- 🔄 **Auto-translation** - Built-in translation capabilities
- 💾 **Local Storage** - Automatic saving to browser localStorage
- ⌨️ **Keyboard Shortcuts** - Efficient editing with keyboard commands
- 📊 **Timeline View** - Visual timeline for subtitle management
- 🎯 **Precise Control** - Split, merge, and adjust subtitle timings

## Installation

```bash
npm install @lilsnake/subtitle-editor tailwindcss
```

or

```bash
yarn add @lilsnake/subtitle-editor tailwindcss
```

or

```bash
pnpm add @lilsnake/subtitle-editor tailwindcss
```

> **Note:** This component requires Tailwind CSS for styling. Make sure Tailwind CSS is installed and configured in your project.

## Usage

### Basic Example

```tsx
import { SubtitleEditor } from '@lilsnake/subtitle-editor';


function App() {
  return (
    <SubtitleEditor
      videoUrl="/path/to/video.mp4"
      subtitleUrl="/path/to/subtitle.srt"
      initialLanguage="en"
    />
  );
}
```

### Multi-language Example

```tsx
import { SubtitleEditor } from '@lilsnake/subtitle-editor';


function App() {
  return (
    <SubtitleEditor
      videoUrl="/path/to/video.mp4"
      subtitleUrls={{
        en: '/path/to/subtitle-en.srt',
        zh: '/path/to/subtitle-zh.srt',
        es: '/path/to/subtitle-es.srt',
      }}
      initialLanguage="en"
      persistToLocal={true}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `videoUrl` | `string` | - | URL of the video file |
| `subtitleUrl` | `string` | - | URL of the subtitle file (single language) |
| `subtitleUrls` | `Record<string, string>` | - | URLs for multiple language subtitles |
| `initialLanguage` | `string` | `'en'` | Initial language to display |
| `persistToLocal` | `boolean` | `true` | Enable/disable localStorage persistence |
| `className` | `string` | - | Additional CSS classes |
| `filmId` | `string` | - | Optional film ID for business integration |

## Keyboard Shortcuts

- `Space` - Play/Pause video
- `Cmd/Ctrl + Z` - Undo changes
- Arrow keys - Navigate timeline

## Supported Formats

- **SRT** - SubRip Text
- **VTT** - WebVTT
- **ASS** - Advanced SubStation Alpha
- **JSON** - Custom JSON format

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Requirements

- React 18.0+ or 19.0+
- Tailwind CSS 4.x (for styling)
- react-i18next for internationalization
- i18next for translations

## Tailwind CSS Setup

This component uses Tailwind CSS for styling. Make sure Tailwind CSS is properly configured in your project:

1. **Install Tailwind CSS** (if not already installed):
   ```bash
   npm install tailwindcss
   ```

2. **Import Tailwind in your CSS entry point**:
   ```css
   @import "tailwindcss";
   ```

3. **Ensure your Tailwind config includes the component's CSS**:
   The component's styles will work automatically if Tailwind is configured in your project.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
