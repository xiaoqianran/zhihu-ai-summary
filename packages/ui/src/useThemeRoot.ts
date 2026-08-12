import { useEffect, useRef } from 'preact/hooks';
import { bindThemeRoot } from './theme';

export function useThemeRoot<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    return bindThemeRoot(el);
  }, []);

  return ref;
}
