export type ExportKind = 'title' | 'body' | 'tag' | 'meta' | 'meters';

export interface ExportBlock {
  kind: ExportKind;
  lines: string[];
  lineHeight: number;
  gap: number;
}

export interface ExportLine {
  kind: ExportKind;
  text: string;
  y: number;
  lineHeight: number;
}

/** Wrap without dropping whitespace or splitting emoji / combining characters. */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  return [...wrappedLines(text, maxWidth, measure)];
}

/** Streaming segmentation keeps very large paragraphs interruptible. */
function* wrappedLines(text: string, maxWidth: number, measure: (text: string) => number) {
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
  let line = '';
  let lastBreak = 0;
  for (const { segment } of segments) {
    if (line && measure(line + segment) > maxWidth) {
      const cut = lastBreak || line.length;
      yield line.slice(0, cut);
      line = line.slice(cut);
      lastBreak = 0;
      if (line && measure(line + segment) > maxWidth) {
        yield line;
        line = '';
      }
    }
    line += segment;
    if (/\s/u.test(segment)) lastBreak = line.length;
  }
  if (line || text === '') yield line;
}

/** Give Close / Escape a chance to abort even one enormous title or paragraph. */
export async function wrapTextAsync(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
  signal: AbortSignal,
): Promise<string[]> {
  signal.throwIfAborted();
  const lines: string[] = [];
  for (const line of wrappedLines(text, maxWidth, measure)) {
    lines.push(line);
    if (lines.length % 32 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      signal.throwIfAborted();
    }
  }
  return lines;
}

/** Keep paragraphs together when possible; split long blocks only between lines. */
export function paginateBlocks(blocks: ExportBlock[], height: number): ExportLine[][] {
  const pages: ExportLine[][] = [];
  let page: ExportLine[] = [];
  let y = 0;
  const nextPage = () => {
    if (page.length) pages.push(page);
    page = [];
    y = 0;
  };
  for (const block of blocks) {
    if (block.lineHeight > height || block.lineHeight <= 0)
      throw new Error('Invalid export line height.');
    const blockHeight = block.lines.length * block.lineHeight;
    if (page.length && blockHeight <= height && y + blockHeight > height) nextPage();
    for (const text of block.lines) {
      if (y + block.lineHeight > height) nextPage();
      page.push({ kind: block.kind, text, y, lineHeight: block.lineHeight });
      y += block.lineHeight;
    }
    y += block.gap;
  }
  nextPage();
  return pages;
}
