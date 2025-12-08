export function getExt(url: string): string {
  return url.trim().toLowerCase().split('.').pop() || '';
}

export function getFileNameFromPath(path: string): string {
  if (!path) return '';
  const sanitized = path.split('?')[0]?.split('#')[0] || '';
  const normalized = sanitized.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.pop() || normalized || '';
}

export function sleep(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function download(url: string, name: string): void {
  const elink = document.createElement('a');
  elink.style.display = 'none';
  elink.href = url;
  elink.download = name;
  document.body.appendChild(elink);
  elink.click();
  document.body.removeChild(elink);
}

export function getKeyCode(event: KeyboardEvent): number | undefined {
  const activeElement = document.activeElement as HTMLElement | null;
  if (!activeElement) return Number(event.keyCode);
  const tag = activeElement.tagName.toUpperCase();
  const editable = activeElement.getAttribute('contenteditable');
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && editable !== '' && editable !== 'true') {
    return Number(event.keyCode);
  }
  return undefined;
}

export function isPlaying(video: HTMLVideoElement): boolean {
  return Boolean(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2);
}
