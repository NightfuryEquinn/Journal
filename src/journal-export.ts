import type { JournalEntry } from './types';
import { fmtDate, fmtTime, fmtJDay, pad } from './format';
import {
  paginateBlocks,
  wrapTextAsync,
  type ExportBlock,
  type ExportKind,
} from './journal-pagination';

const WIDTH = 1080;
const HEIGHT = 1350;
const CONTENT_X = 96;
const CONTENT_Y = 218;
const CONTENT_WIDTH = WIDTH - CONTENT_X * 2;
const CONTENT_HEIGHT = 974;
const styles: Record<
  ExportKind,
  { size: number; height: number; family: 'headline' | 'mono'; weight: number }
> = {
  title: { size: 52, height: 66, family: 'headline', weight: 500 },
  body: { size: 30, height: 48, family: 'mono', weight: 400 },
  tag: { size: 24, height: 38, family: 'mono', weight: 400 },
  meta: { size: 22, height: 36, family: 'mono', weight: 400 },
  meters: { size: 22, height: 48, family: 'mono', weight: 400 },
};

export interface JournalImage {
  blob: Blob;
  filename: string;
}

/** Private journal plaintext stays in this browser. Only PNG blobs leave this function. */
export async function generateJournalImages(
  entry: JournalEntry,
  signal: AbortSignal,
  onPage: (image: JournalImage, current: number, total: number) => void,
): Promise<void> {
  const theme = getComputedStyle(document.documentElement);
  const color = (name: string) => theme.getPropertyValue(`--${name}`).trim();
  const families = { headline: color('headline'), mono: color('mono') };
  const font = (kind: ExportKind) => {
    const style = styles[kind];
    return `${style.weight} ${style.size}px ${families[style.family]}`;
  };
  await Promise.all([
    document.fonts.load(font('title'), entry.title),
    document.fonts.load(font('body'), entry.body),
    document.fonts.load(font('meta'), `JOURNS ${entry.weather} ${entry.tags.join(' ')}`),
  ]);
  await document.fonts.ready;
  signal.throwIfAborted();

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create an image. Please try another browser.');
  const blocks: ExportBlock[] = [];
  const add = async (text: string, kind: ExportKind, gap: number) => {
    ctx.font = font(kind);
    let count = 0;
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      blocks.push({
        kind,
        lines: await wrapTextAsync(
          paragraph,
          CONTENT_WIDTH - (kind === 'tag' ? 20 : 0),
          (t) => ctx.measureText(t).width,
          signal,
        ),
        lineHeight: styles[kind].height,
        gap,
      });
      if (++count % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        signal.throwIfAborted();
      }
    }
  };
  const d = new Date(entry.date);
  const words = entry.body.trim() ? entry.body.trim().split(/\s+/u).length : 0;
  try {
    await add(`${fmtDate(d)} · ${fmtTime(d)} · J-DAY ${fmtJDay(d)}`, 'meta', 16);
    await add(entry.title, 'title', 20);
    if (entry.tags.length) await add(entry.tags.map((tag) => `#${tag}`).join('  '), 'tag', 16);
    await add(`WEATHER · ${entry.weather}`, 'meta', 0);
    blocks.push({ kind: 'meters', lines: [''], lineHeight: styles.meters.height, gap: 12 });
    await add(`${words} WORDS · ~${Math.max(1, Math.round(words / 200))} MIN READ`, 'meta', 28);
    // Yield during large entries so closing the dialog can cancel generation.
    const paragraphs = entry.body.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < paragraphs.length; i++) {
      await add(paragraphs[i], 'body', paragraphs[i] === '' ? 0 : 16);
      if (i % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        signal.throwIfAborted();
      }
    }
    const pages = paginateBlocks(blocks, CONTENT_HEIGHT);
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const text = (value: string, x: number, y: number, kind: ExportKind, ink = color('fg')) => {
      ctx.font = font(kind);
      ctx.fillStyle = ink;
      ctx.fillText(value, x, y);
    };
    const rule = (x: number, y: number, width: number, ink: string) => {
      ctx.fillStyle = ink;
      ctx.fillRect(x, y, width, 2);
    };
    const meter = (label: string, value: number, x: number, y: number) => {
      text(label, x, y + 6, 'meta', color('fg-dim'));
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = color(i < value ? 'accent' : 'line-strong');
        ctx.fillRect(x + 110 + i * 24, y + 6, 12, 24);
      }
      text(`${value}/5`, x + 242, y + 6, 'meta');
    };
    for (let i = 0; i < pages.length; i++) {
      signal.throwIfAborted();
      ctx.textBaseline = 'top';
      ctx.fillStyle = color('bg');
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      text('J O U R N S', 64, 52, 'meta');
      const counter = `FIELD JOURNAL · ${pad(i + 1)} / ${pad(pages.length)}`;
      ctx.font = font('meta');
      text(counter, WIDTH - 64 - ctx.measureText(counter).width, 52, 'meta', color('fg-dim'));
      ctx.fillStyle = color('bg-1');
      ctx.fillRect(48, 120, 984, 1158);
      ctx.strokeStyle = color('line-strong');
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 120, 984, 1158);
      rule(48, 120, 100, color('accent'));
      text(
        i === 0 ? 'LOG ENTRY' : 'LOG ENTRY · CONTINUED',
        CONTENT_X,
        154,
        'meta',
        color('accent'),
      );
      rule(CONTENT_X, 196, CONTENT_WIDTH, color('line'));
      for (const line of pages[i]) {
        const y = CONTENT_Y + line.y;
        if (line.kind === 'meters') {
          meter('MOOD', entry.mood, CONTENT_X, y);
          meter('ENERGY', entry.energy, CONTENT_X + 440, y);
        } else if (line.kind === 'tag') {
          ctx.font = font('tag');
          const width = ctx.measureText(line.text).width + 16;
          ctx.fillStyle = color('accent-soft');
          ctx.fillRect(CONTENT_X, y, width, 34);
          ctx.strokeStyle = color('line-strong');
          ctx.strokeRect(CONTENT_X, y, width, 34);
          text(line.text, CONTENT_X + 8, y + 4, 'tag', color('accent'));
        } else {
          text(
            line.text,
            CONTENT_X,
            y + 4,
            line.kind,
            color(line.kind === 'meta' ? 'fg-dim' : 'fg'),
          );
        }
      }
      rule(CONTENT_X, 1214, CONTENT_WIDTH, color('line-strong'));
      text(
        i === pages.length - 1 ? 'END OF LOG' : 'CONTINUED ON NEXT PAGE',
        CONTENT_X,
        1234,
        'meta',
        color('accent'),
      );
      ctx.font = font('meta');
      text(date, WIDTH - CONTENT_X - ctx.measureText(date).width, 1234, 'meta', color('fg-dim'));
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error('Could not save this image. Please retry.')),
          'image/png',
        ),
      );
      signal.throwIfAborted();
      onPage(
        { blob, filename: `journs-${date}-${String(i + 1).padStart(2, '0')}.png` },
        i + 1,
        pages.length,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
