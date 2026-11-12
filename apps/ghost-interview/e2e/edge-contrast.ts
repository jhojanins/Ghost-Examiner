import type { Locator } from '@playwright/test';

/**
 * The strongest contrast between the page just left of a panel and the pixels across its left
 * edge, as rendered: a 12 px strip at the panel's middle row, decoded in the page with a canvas.
 * Panels share a fill close to the fixed page gradient, so only a drawn edge can reach 3:1
 * (spec b tasks 33b and 35b; 3:1 as in WCAG 1.4.11).
 */
export async function edgeContrast(panel: Locator): Promise<number> {
  const page = panel.page();
  await panel.scrollIntoViewIfNeeded();
  const box = (await panel.boundingBox())!;
  const y = Math.round(box.y + box.height / 2);
  const png = await page.screenshot({ clip: { x: Math.round(box.x) - 6, y, width: 12, height: 1 } });
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [img.width, img.height];
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, 1).data;
    const lum = (i: number) => {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const outside = lum(0);
    let best = 1;
    for (let i = 4; i < data.length; i += 4) {
      const [hi, lo] = [Math.max(outside, lum(i)), Math.min(outside, lum(i))];
      best = Math.max(best, (hi + 0.05) / (lo + 0.05));
    }
    return best;
  }, `data:image/png;base64,${png.toString('base64')}`);
}
