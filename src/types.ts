export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  mood: number;
  energy: number;
  weather: string;
  tags: string[];
  body: string;
}

export type ListLayout = 'timeline' | 'stack';

export type AppView =
  | { name: 'login' }
  | { name: 'list' }
  | { name: 'read'; entry: JournalEntry }
  | { name: 'compose'; existing: JournalEntry | null };

export interface TweakValues {
  paletteSwatch: string[];
  type: string;
  density: string;
  depth: number;
  scanlines: boolean;
}
