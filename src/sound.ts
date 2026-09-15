import { Howl, Howler } from 'howler';
import onclickSrc from '../audio/onclick.wav?url';
import ondeleteSrc from '../audio/ondelete.wav?url';
import onhoverSrc from '../audio/onhover.wav?url';
import onpageloadSrc from '../audio/onpageload.wav?url';
import onshepherdSrc from '../audio/onshepherd.wav?url';
import ontypeSrc from '../audio/ontype.wav?url';

/** Howler-backed UI sound effects gated by the topbar audio toggle. */
export const SoundManager = (() => {
  let enabled = false;

  Howler.mute(true);

  /** Create a preloaded Howl for a WAV asset. */
  const make = (src: string, volume = 0.55) =>
    new Howl({
      src: [src],
      volume,
      preload: true,
    });

  const clickSound = make(onclickSrc, 0.5);
  const deleteSound = make(ondeleteSrc, 0.55);
  const hoverSound = make(onhoverSrc, 0.3);
  const pageLoadSound = make(onpageloadSrc, 0.6);
  const shepherdSound = make(onshepherdSrc, 0.55);
  const typeSound = make(ontypeSrc, 0.35);

  /** Play a Howl when audio is enabled. */
  const play = (sound: Howl) => {
    if (!enabled) {
      return;
    }

    sound.play();
  };

  return {
    /** Enable or disable sound output. */
    setEnabled(v: boolean) {
      enabled = !!v;
      Howler.mute(!enabled);
    },
    /** Whether sound is currently enabled. */
    isEnabled: () => enabled,
    /** Button / interactive hover. */
    hover() {
      play(hoverSound);
    },
    /** CTA / button click. */
    click() {
      play(clickSound);
    },
    /** Keyboard typing keydown. */
    type() {
      play(typeSound);
    },
    /** No-op confirm (no dedicated asset). */
    confirm() {},
    /** No-op deny (no dedicated asset). */
    deny() {},
    /** Screen / page transition stinger. */
    pageLoad() {
      play(pageLoadSound);
    },
    /** Alias for page-load stinger (login boot sequence). */
    boot() {
      play(pageLoadSound);
    },
    /** Delete-confirmation modal open. */
    delete() {
      play(deleteSound);
    },
    /** Shepherd tour modal open. */
    shepherd() {
      play(shepherdSound);
    },
  };
})();
