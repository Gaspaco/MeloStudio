type Lang = "en" | "es" | "fr" | "de" | "pt" | "ja" | "ko" | "zh" | "ru" | "ar";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages: string;
            autoDisplay: boolean;
          },
          elementId: string,
        ) => unknown;
      };
    };
  }
}

const languages = new Set<Lang>(["en", "es", "fr", "de", "pt", "ja", "ko", "zh", "ru", "ar"]);
const GOOGLE_ELEMENT_ID = "google_translate_element";
const GOOGLE_SCRIPT_ID = "google-translate-script";
const GOOGLE_LANG: Record<Lang, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  ja: "ja",
  ko: "ko",
  zh: "zh-CN",
  ru: "ru",
  ar: "ar",
};

let currentLang: Lang = "en";
let scriptPromise: Promise<void> | undefined;
let applyTimer: number | undefined;
let cleanupObserver: MutationObserver | undefined;
let cleanupObserverTimer: number | undefined;

const GOOGLE_BANNER_SELECTORS = [
  "iframe.goog-te-banner-frame",
  ".goog-te-banner-frame",
  ".goog-te-balloon-frame",
  ".VIpgJd-ZVi9od-ORHb-OEVmcd",
  ".VIpgJd-ZVi9od-aZ2wEe-wOHMyf",
  'iframe[title*="Language Translate Widget"]',
].join(",");

function getSavedLanguage(): Lang {
  const saved = localStorage.getItem("ms_lang");
  return languages.has(saved as Lang) ? (saved as Lang) : "en";
}

function ensureGoogleContainer() {
  if (document.getElementById(GOOGLE_ELEMENT_ID)) return;
  const container = document.createElement("div");
  container.id = GOOGLE_ELEMENT_ID;
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "1px";
  container.style.height = "1px";
  container.style.overflow = "hidden";
  document.body.appendChild(container);
}

function injectGoogleCleanupStyles() {
  if (document.getElementById("google-translate-cleanup-style")) return;
  const style = document.createElement("style");
  style.id = "google-translate-cleanup-style";
  style.textContent = `
    #google_translate_element,
    .goog-te-banner-frame,
    .goog-te-balloon-frame,
    .goog-te-menu-frame,
    .goog-te-spinner-pos,
    .goog-te-gadget,
    .goog-tooltip,
    .goog-tooltip:hover,
    iframe.skiptranslate,
    .VIpgJd-ZVi9od-ORHb-OEVmcd,
    .VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
    iframe[title*="Language Translate Widget"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      border: 0 !important;
    }

    html,
    body {
      top: 0 !important;
      margin-top: 0 !important;
    }

    body > .skiptranslate,
    .skiptranslate {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function removeGoogleBannerLayers() {
  document.querySelectorAll<HTMLElement>(GOOGLE_BANNER_SELECTORS).forEach((element) => {
    element.remove();
  });

  document.documentElement.style.setProperty("top", "0px", "important");
  document.documentElement.style.setProperty("margin-top", "0px", "important");
  document.body.style.setProperty("top", "0px", "important");
  document.body.style.setProperty("margin-top", "0px", "important");
}

function watchGoogleBannerLayers() {
  removeGoogleBannerLayers();
  if (cleanupObserver) return;

  // Google appends its banner/iframe as a direct child of <body>, so watch only
  // body's child list — NOT the whole document subtree, which would fire this on
  // every DOM mutation in the app (a constant drain, especially in the studio).
  cleanupObserver = new MutationObserver((mutations) => {
    const hasGoogleLayer = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) =>
        node instanceof Element
        && (node.matches(GOOGLE_BANNER_SELECTORS) || Boolean(node.querySelector(GOOGLE_BANNER_SELECTORS))),
      ),
    );
    if (hasGoogleLayer) removeGoogleBannerLayers();
  });
  cleanupObserver.observe(document.body, {
    childList: true,
  });

  window.clearTimeout(cleanupObserverTimer);
  cleanupObserverTimer = window.setTimeout(() => {
    cleanupObserver?.disconnect();
    cleanupObserver = undefined;
  }, 6000);
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/`;

  const hostParts = window.location.hostname.split(".");
  if (hostParts.length > 1) {
    document.cookie = `${name}=${value}; expires=${expires}; path=/; domain=.${hostParts.slice(-2).join(".")}`;
  }
}

function clearGoogleTranslation() {
  setCookie("googtrans", "", -1);
  setCookie("googtrans", "/en/en", -1);
}

function primeGoogleCookie(lang: Lang) {
  if (lang === "en") {
    clearGoogleTranslation();
    return;
  }

  setCookie("googtrans", `/en/${GOOGLE_LANG[lang]}`, 365);
}

function loadGoogleTranslate() {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve) => {
    ensureGoogleContainer();
    injectGoogleCleanupStyles();
    watchGoogleBannerLayers();

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) {
        resolve();
        return;
      }

      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,es,fr,de,pt,ja,ko,zh-CN,ru,ar",
          autoDisplay: false,
        },
        GOOGLE_ELEMENT_ID,
      );
      removeGoogleBannerLayers();
      resolve();
    };

    if (window.google?.translate?.TranslateElement) {
      window.googleTranslateElementInit();
      return;
    }

    if (document.getElementById(GOOGLE_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function getGoogleCombo(): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>(".goog-te-combo");
}

function triggerGoogleLanguage(lang: Lang) {
  const googleLang = GOOGLE_LANG[lang];
  const combo = getGoogleCombo();
  if (!combo) return false;

  if (lang === "en") {
    clearGoogleTranslation();
  } else {
    setCookie("googtrans", `/en/${googleLang}`, 365);
  }

  combo.value = googleLang;
  combo.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function scheduleApply(lang: Lang, delay = 500) {
  window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => {
    void applyLanguage(lang);
  }, delay);
}

export async function applyLanguage(lang = getSavedLanguage()) {
  currentLang = languages.has(lang as Lang) ? (lang as Lang) : "en";
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  document.documentElement.dataset.msLang = currentLang;
  document.documentElement.classList.toggle("ms-translated", currentLang !== "en");
  primeGoogleCookie(currentLang);

  // Do not inject Google's banner/iframe machinery for the original language.
  // It is unnecessary on English pages and can leave a stale compositor strip
  // after opening a shared project in a new tab.
  if (
    currentLang === "en"
    && !document.getElementById(GOOGLE_SCRIPT_ID)
    && !window.google?.translate?.TranslateElement
  ) {
    removeGoogleBannerLayers();
    return;
  }

  await loadGoogleTranslate();

  for (let attempt = 0; attempt < 12; attempt++) {
    if (triggerGoogleLanguage(currentLang)) return;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
}

export function setAppLanguage(lang: string) {
  const next = languages.has(lang as Lang) ? (lang as Lang) : "en";
  localStorage.setItem("ms_lang", next);
  window.dispatchEvent(new CustomEvent("ms:language-change", { detail: { language: next } }));
}

export function installI18n() {
  void applyLanguage();

  const onLanguageChange = (event: Event) => {
    const language = (event as CustomEvent<{ language?: string }>).detail?.language;
    scheduleApply(languages.has(language as Lang) ? (language as Lang) : getSavedLanguage(), 50);
  };

  window.addEventListener("ms:language-change", onLanguageChange);

  return () => {
    window.clearTimeout(applyTimer);
    window.clearTimeout(cleanupObserverTimer);
    cleanupObserver?.disconnect();
    cleanupObserver = undefined;
    window.removeEventListener("ms:language-change", onLanguageChange);
  };
}
