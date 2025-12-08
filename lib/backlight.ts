import { isPlaying } from '../utils';

type MatrixItem = {
  $box: HTMLDivElement;
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};

function matrixCallback<T>(callback: (xIndex: number, yIndex: number, x: number, y: number) => T): T[] {
  const result: T[] = [];
  const x = 10;
  const y = 5;
  for (let xIndex = 0; xIndex < x; xIndex += 1) {
    for (let yIndex = 0; yIndex < y; yIndex += 1) {
      if (xIndex === 0 || xIndex === x - 1 || yIndex === 0 || yIndex === y - 1) {
        result.push(callback(xIndex, yIndex, x, y));
      }
    }
  }
  return result;
}

function getColors($canvas: HTMLCanvasElement, $video: HTMLVideoElement, width: number, height: number) {
  const ctx = $canvas.getContext('2d');
  if (!ctx) return [];
  $canvas.width = width;
  $canvas.height = height;
  ctx.drawImage($video, 0, 0, width, height);
  return matrixCallback((xIndex, yIndex, x, y) => {
    const itemW = width / x;
    const itemH = height / y;
    const itemX = xIndex * itemW;
    const itemY = yIndex * itemH;
    if (itemW < 1 || itemH < 1) return { r: 0, g: 0, b: 0 };
    const { data } = ctx.getImageData(itemX, itemY, itemW, itemH);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const factor = data.length / 4 || 1;
    r = Math.floor(r / factor);
    g = Math.floor(g / factor);
    b = Math.floor(b / factor);
    return { r, g, b };
  });
}

function createMatrix(parent: HTMLDivElement): MatrixItem[] {
  return matrixCallback((xIndex, yIndex, x, y) => {
    const $box = document.createElement('div');
    $box.style.position = 'absolute';
    $box.style.left = `${(xIndex * 100) / x}%`;
    $box.style.top = `${(yIndex * 100) / y}%`;
    $box.style.width = `${100 / x}%`;
    $box.style.height = `${100 / y}%`;
    $box.style.borderRadius = '50%';
    $box.style.transition = 'all .2s ease';
    parent.appendChild($box);
    return {
      $box,
      left: xIndex === 0,
      right: xIndex === x - 1,
      top: yIndex === 0,
      bottom: yIndex === y - 1,
    };
  });
}

export default function backlight($player: HTMLDivElement, $video: HTMLVideoElement) {
  const $backlight = document.createElement('div');
  $backlight.classList.add('backlight');
  Object.assign($backlight.style, {
    position: 'absolute',
    zIndex: '9',
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    width: '100%',
    height: '100%',
  });

  const matrix = createMatrix($backlight);
  const $canvas = document.createElement('canvas');
  $player.insertBefore($backlight, $video);

  const run = () => {
    const { clientWidth, clientHeight } = $video;
    const colors = getColors($canvas, $video, clientWidth, clientHeight);
    colors.forEach(({ r, g, b }, index) => {
      const { $box, left, right, top, bottom } = matrix[index];
      const x = left ? '-64px' : right ? '64px' : '0';
      const y = top ? '-64px' : bottom ? '64px' : '0';
      $box.style.boxShadow = `rgb(${r}, ${g}, ${b}) ${x} ${y} 128px`;
    });
  };

  $video.addEventListener('seeked', run);
  $video.addEventListener('loadedmetadata', () => setTimeout(run, 1000));

  (function loop() {
    window.requestAnimationFrame(() => {
      if (isPlaying($video)) {
        run();
      }
      loop();
    });
  })();
}
