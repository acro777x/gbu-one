import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * GBU One — the OS "reduce motion" setting.
 *
 * Every animated component asks this hook whether it may animate. The prop
 * on the component always wins (`reduceMotion ?? systemReduce`), so a screen
 * can force the motion off (or on) regardless of the OS setting.
 *
 * The `AccessibilityInfo` calls are guarded: on a platform (or a test
 * harness) that does not implement them the hook simply reports "no
 * preference" instead of throwing inside an effect.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const info = AccessibilityInfo as
      | (typeof AccessibilityInfo & {
          isReduceMotionEnabled?: () => Promise<boolean>;
          addEventListener?: (
            event: string,
            handler: (enabled: boolean) => void,
          ) => { remove?: () => void } | undefined;
        })
      | undefined;

    const apply = (enabled: boolean) => {
      if (isMounted) setReduce(!!enabled);
    };

    try {
      if (typeof info?.isReduceMotionEnabled === 'function') {
        info.isReduceMotionEnabled().then(apply).catch(() => {});
      }
    } catch {
      // The platform does not expose the setting: treat it as "off".
    }

    let subscription: { remove?: () => void } | undefined;
    try {
      if (typeof info?.addEventListener === 'function') {
        subscription = info.addEventListener('reduceMotionChanged', apply);
      }
    } catch {
      // ignore: no live updates, the initial read is enough.
    }

    return () => {
      isMounted = false;
      try {
        subscription?.remove?.();
      } catch {
        // ignore
      }
    };
  }, []);

  return reduce;
}

export default useReduceMotion;
