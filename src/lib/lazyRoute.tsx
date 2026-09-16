import { lazy, type ComponentType } from 'react';

export interface PreloadableComponent<P extends object> {
  (props: P): React.ReactNode;
  /** Fetches and caches the module; resolves once the component can render synchronously. */
  preload: () => Promise<void>;
}

/**
 * `React.lazy` with an explicit preload hook.
 *
 * `React.lazy` always suspends on its first render — even when the module is
 * already in memory — which would flash the Suspense fallback over the static
 * shell for one frame. Once `preload()` has resolved, this wrapper renders the
 * real component directly, so the first React commit paints the final page.
 */
export function lazyRoute<P extends object>(load: () => Promise<ComponentType<P>>): PreloadableComponent<P> {
  let Resolved: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;

  const preload = () => {
    pending ??= load().then((component) => {
      Resolved = component;
    });
    return pending;
  };

  const Lazy = lazy(() => preload().then(() => ({ default: Resolved as ComponentType<P> })));

  const Route: PreloadableComponent<P> = (props: P) => {
    if (Resolved) {
      const Component = Resolved;
      return <Component {...props} />;
    }
    return <Lazy {...(props as P & React.JSX.IntrinsicAttributes)} />;
  };
  Route.preload = preload;
  return Route;
}
