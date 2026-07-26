import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { SoundManager } from './hud';

export const TOUR_KEY = 'journs.tour.v1';

/** Mark the product tour as completed. */
export function markTourDone(): void {
  localStorage.setItem(TOUR_KEY, '1');
}

/** Clear completion so the tour can replay. */
export function resetTour(): void {
  localStorage.removeItem(TOUR_KEY);
}

/** Start the Shepherd tour when DOM anchors exist (retries briefly). */
export function maybeStartTour(options?: { force?: boolean }): void {
  if (options?.force) {
    resetTour();
  }

  if (localStorage.getItem(TOUR_KEY) === '1') {
    return;
  }

  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      classes: 'journs-shepherd',
      scrollTo: { behavior: 'smooth', block: 'center' },
    },
  });

  tour.addStep({
    id: 'archive',
    text: 'Your encrypted field archive lives here. Entries sync as ciphertext to MongoDB.',
    attachTo: { element: '[data-tour="tour-archive"]', on: 'bottom' },
    buttons: [{ text: 'NEXT', action: tour.next }],
  });

  tour.addStep({
    id: 'compose',
    text: 'Log a new entry. Plaintext never leaves the device unencrypted.',
    attachTo: { element: '[data-tour="tour-compose"]', on: 'bottom' },
    buttons: [
      { text: 'BACK', action: tour.back, secondary: true },
      { text: 'NEXT', action: tour.next },
    ],
  });

  tour.addStep({
    id: 'profile',
    text: 'Profile holds AURA quests, import/export, and the transparency map.',
    attachTo: { element: '[data-tour="tour-profile"]', on: 'bottom' },
    buttons: [
      { text: 'BACK', action: tour.back, secondary: true },
      { text: 'NEXT', action: tour.next },
    ],
  });

  tour.addStep({
    id: 'done',
    text: 'You are clear to operate. Replay this tour anytime from the archive list.',
    buttons: [
      {
        text: 'DONE',
        action: () => {
          markTourDone();
          tour.complete();
        },
      },
    ],
  });

  tour.on('cancel', () => markTourDone());
  tour.on('complete', () => markTourDone());
  tour.on('show', () => SoundManager.shepherd());

  /** Wait for archive anchors after signup → list transition. */
  const startWhenReady = (attempt = 0) => {
    const hasAnchor = document.querySelector('[data-tour="tour-archive"]');

    if (hasAnchor) {
      void tour.start();

      return;
    }

    if (attempt < 30) {
      setTimeout(() => startWhenReady(attempt + 1), 100);
    }
  };

  setTimeout(() => startWhenReady(), 200);
}
