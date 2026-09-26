// motion.ts — anime.js entrance + scroll-scrub helpers, shared across screens
import { animate, onScroll, stagger } from 'animejs';
import { useLayoutEffect, type RefObject } from 'react';

/** True when the visitor's OS/browser requests reduced motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scroll-linked effects (scrub, sticky-adjacent reveals) are laptop+ only. */
function canScrollLink(): boolean {
  return (
    window.matchMedia('(min-width: 980px)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Stagger-reveal every `[data-reveal]` element inside `scope`, once, on mount.
 * A no-op under prefers-reduced-motion, so those visitors see the final
 * layout immediately rather than a suppressed mid-animation frame.
 */
export function useEntrance(scope: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = scope.current;

    if (!root || prefersReducedMotion()) {
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');

    if (targets.length === 0) {
      return;
    }

    const anim = animate(targets, {
      opacity: [0, 1],
      translateY: [14, 0],
      duration: 520,
      ease: 'outQuad',
      delay: stagger(60),
    });

    return () => {
      anim.pause();
    };
  }, [scope]);
}

/**
 * Scroll-scrub the opacity of every element matching `selector` inside
 * `scope`, against the app scroller. Used for the landing page's
 * word-by-word paragraph reveal. No-ops under reduced motion, leaving
 * elements at full opacity.
 */
export function useScrubReveal(scope: RefObject<HTMLElement | null>, selector: string): void {
  useLayoutEffect(() => {
    const root = scope.current;

    if (!root || !canScrollLink()) {
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>(selector);

    if (targets.length === 0) {
      return;
    }

    // Default enter/leave thresholds (element start crosses container end, and
    // back) are what anime.js actually tests against; hand-rolled offset
    // strings here previously left the section stuck off-screen.
    const anim = animate(targets, {
      opacity: [0.12, 1],
      autoplay: onScroll({
        container: '#app-scroller',
        sync: true,
      }),
    });

    return () => {
      anim.pause();
    };
  }, [scope, selector]);
}

/**
 * Fade + rise a set of elements in as they individually cross into view,
 * scrolling against the app scroller. Used for the "how it works" panels
 * that scroll past a sticky column.
 */
export function useEnterOnScroll(scope: RefObject<HTMLElement | null>, selector: string): void {
  useLayoutEffect(() => {
    const root = scope.current;

    if (!root || !canScrollLink()) {
      return;
    }

    const targets = root.querySelectorAll<HTMLElement>(selector);

    if (targets.length === 0) {
      return;
    }

    // Default enter/leave thresholds, same reasoning as useScrubReveal above.
    const anims = Array.from(targets).map((el) =>
      animate(el, {
        opacity: [0, 1],
        translateY: [24, 0],
        duration: 600,
        ease: 'outQuad',
        autoplay: onScroll({
          container: '#app-scroller',
        }),
      }),
    );

    return () => {
      anims.forEach((a) => a.pause());
    };
  }, [scope, selector]);
}
