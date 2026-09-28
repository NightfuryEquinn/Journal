import assert from 'node:assert/strict';
import { paginateBlocks, wrapText, wrapTextAsync } from '../src/journal-pagination';

const width = (text: string) =>
  [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;

assert.deepEqual(wrapText('hello world', 6, width), ['hello ', 'world']);
assert.deepEqual(wrapText('abcdefghij', 4, width), ['abcd', 'efgh', 'ij']);
assert.deepEqual(wrapText('👨‍👩‍👧‍👦🙂中文e\u0301', 2, width), ['👨‍👩‍👧‍👦🙂', '中文', 'e\u0301']);
assert.deepEqual(wrapText('', 6, width), ['']);
const original = 'A  journal with  spaces, 中文 and 👨‍👩‍👧‍👦.';
assert.equal(wrapText(original, 8, width).join(''), original);

const block = (lines: string[], gap = 0) => ({ kind: 'body' as const, lines, lineHeight: 10, gap });
// Exact fit must not produce an empty trailing page.
assert.deepEqual(
  paginateBlocks([block(['a', 'b', 'c'])], 30).map((p) => p.map((l) => l.text)),
  [['a', 'b', 'c']],
);
// A paragraph that fits a fresh page stays together.
assert.deepEqual(
  paginateBlocks([block(['a', 'b']), block(['c', 'd'])], 30).map((p) => p.map((l) => l.text)),
  [
    ['a', 'b'],
    ['c', 'd'],
  ],
);
// Oversized paragraphs flow across pages; blank lines survive.
assert.deepEqual(
  paginateBlocks([block(['a', '', 'b', 'c', 'd', 'e', 'f'])], 30).map((p) => p.map((l) => l.text)),
  [['a', '', 'b'], ['c', 'd', 'e'], ['f']],
);
const pages = paginateBlocks([block(['a'], 15), block(['b', 'c', 'd', 'e'])], 30);
assert.deepEqual(
  pages.flat().map((l) => l.text),
  ['a', 'b', 'c', 'd', 'e'],
);
assert.ok(
  pages.every((page) => page.every((line) => line.y >= 0 && line.y + line.lineHeight <= 30)),
);
assert.deepEqual(
  paginateBlocks(
    [{ kind: 'title', lines: ['long', 'title', 'here', 'last'], lineHeight: 10, gap: 5 }],
    20,
  ).map((p) => p.map((l) => l.text)),
  [
    ['long', 'title'],
    ['here', 'last'],
  ],
);
const cancel = new AbortController();
setTimeout(() => cancel.abort(), 0);
await assert.rejects(
  wrapTextAsync('unbroken'.repeat(10000), 30, (text) => text.length, cancel.signal),
  { name: 'AbortError' },
);
assert.deepEqual(
  await wrapTextAsync(original, 8, width, new AbortController().signal),
  wrapText(original, 8, width),
);
console.log(
  'Journal export: wrapping, Unicode, content preservation, paragraph breaks, and page bounds passed.',
);
