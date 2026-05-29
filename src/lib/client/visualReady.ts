type VisualReadyOptions = {
  frames?: number;
  stylesheetsMaxWait?: number;
  totalMaxWait?: number;
};

export function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame === "undefined") return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function waitForAllStylesheets(maxWait = 3000): Promise<void> {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    let observer: MutationObserver | null = null;
    const timer = window.setTimeout(done, maxWait);

    function done() {
      window.clearTimeout(timer);
      observer?.disconnect();
      resolve();
    }

    function check() {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      );
      const pending = links.filter((link) => !link.sheet && !(link as any)._foucFailed);

      if (pending.length === 0) {
        done();
        return;
      }

      for (const link of pending) {
        if ((link as any)._foucWatching) continue;
        (link as any)._foucWatching = true;
        link.addEventListener("load", check, { once: true });
        link.addEventListener("error", () => {
          (link as any)._foucFailed = true;
          check();
        }, { once: true });
      }
    }

    observer = new MutationObserver(check);
    observer.observe(document.head, { childList: true, subtree: true });
    check();
  });
}

export async function waitForVisualReady(options: VisualReadyOptions = {}): Promise<void> {
  if (typeof window === "undefined") return;

  const frames = options.frames ?? 2;
  const stylesheetsMaxWait = options.stylesheetsMaxWait ?? 1800;
  const totalMaxWait = options.totalMaxWait ?? 2200;

  for (let i = 0; i < frames; i += 1) await nextFrame();

  const fontsReady = typeof document !== "undefined" && "fonts" in document
    ? document.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve();

  await Promise.race([
    Promise.all([waitForAllStylesheets(stylesheetsMaxWait), fontsReady]),
    new Promise<void>((resolve) => window.setTimeout(resolve, totalMaxWait)),
  ]);
}