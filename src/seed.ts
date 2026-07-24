import type { JournalEntry } from './types';

export const SEED_ENTRIES: JournalEntry[] = [
  {
    id: 'e-2026-05-16',
    date: '2026-05-16T22:14:00',
    title: 'Quiet protocol on the ridge road',
    mood: 4,
    energy: 3,
    weather: 'CLEAR',
    tags: ['recon', 'self', 'commute'],
    body: `Drove the ridge road back. There were three deer at the second switchback; I cut the engine and watched them for a long moment.

The fog in the valley had that soft grey weight to it — the kind that makes the whole world feel briefly held.

Tomorrow: finish the schematic for the relay tower. Don't forget to call M.`,
  },
  {
    id: 'e-2026-05-15',
    date: '2026-05-15T08:02:00',
    title: 'First coffee, then everything else',
    mood: 5,
    energy: 4,
    weather: 'OVERCAST',
    tags: ['ritual', 'work'],
    body: `Slept eight hours for the first time in two weeks. Body remembered how that feels — strange.

Cleaned the workbench before sitting down. Found the notebook I thought I'd lost in March. The dumbest things make me happy.`,
  },
  {
    id: 'e-2026-05-12',
    date: '2026-05-12T19:48:00',
    title: 'Long phone call with K.',
    mood: 3,
    energy: 2,
    weather: 'LIGHT RAIN',
    tags: ['family', 'difficult'],
    body: `K. is moving again. Third time in two years. I tried not to sound disappointed. I think I failed.

Reminder: love is not the same as approval. Sit with that.`,
  },
  {
    id: 'e-2026-05-09',
    date: '2026-05-09T14:31:00',
    title: 'Field test · cold cell pack #4',
    mood: 4,
    energy: 4,
    weather: 'CLEAR',
    tags: ['lab', 'equipment'],
    body: `Cell #4 held charge for the full 9-hour outdoor cycle at near-freezing. That's a 22% improvement over the previous batch.

Photos in the side folder. Need to write up findings before Monday's review.`,
  },
  {
    id: 'e-2026-05-06',
    date: '2026-05-06T07:55:00',
    title: 'Morning fog observation',
    mood: 4,
    energy: 3,
    weather: 'FOG',
    tags: ['ritual', 'nature'],
    body: `Walked to the overlook before sunrise. Couldn't see the river but I could hear it.

A heron passed overhead, just a shape in the grey. Counted: 14 wingbeats, then a glide, then 14 more.`,
  },
  {
    id: 'e-2026-05-03',
    date: '2026-05-03T23:01:00',
    title: 'Insomnia ledger',
    mood: 2,
    energy: 1,
    weather: 'CLEAR',
    tags: ['health', 'difficult'],
    body: `Third night in a row. Mind kept circling the same three problems.

Reading helped a little. Made tea at 02:30. Watched the kitchen window go from black to blue to grey.`,
  },
  {
    id: 'e-2026-04-30',
    date: '2026-04-30T18:22:00',
    title: 'Month-end review',
    mood: 4,
    energy: 4,
    weather: 'CLEAR',
    tags: ['review', 'planning'],
    body: `April was a month of small steady wins.

— Shipped two of three planned modules.
— Read four books.
— Ran 78 km total.

May goals: finish the third module, write to D., and take one day completely offline.`,
  },
  {
    id: 'e-2026-04-26',
    date: '2026-04-26T16:08:00',
    title: 'Lab note · solar array calibration',
    mood: 3,
    energy: 3,
    weather: 'CLEAR',
    tags: ['lab', 'equipment'],
    body: `Recalibrated panels A2 and B3. Output up 4%. Still below the simulation prediction by ~7%.

Suspect partial shading from the new tree growth east of the site. Need to survey.`,
  },
];
