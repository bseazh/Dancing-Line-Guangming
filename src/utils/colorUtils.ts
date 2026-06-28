/**
 * Parse any CSS color string (including rgba/hsla) into a hex number
 * by rendering it to an offscreen canvas pixel.
 */
export function parseCssColor(css: string): number {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ff00ff'; // sentinel
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (r << 16) | (g << 8) | b;
}

export function parseCssColorStr(css: string): string {
  const n = parseCssColor(css);
  return '#' + n.toString(16).padStart(6, '0');
}
