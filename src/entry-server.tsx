import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-app-booting="">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#07070a" />
          <style>{`
            html, body, #app {
              width: 100%;
              max-width: 100%;
              min-height: 100%;
              background: #07070a;
              overflow-x: clip;
            }
            html {
              min-height: 100%;
              color-scheme: dark;
            }
            body {
              margin: 0;
              min-height: 100%;
              background: #07070a;
              color: #f4f1ea;
            }
            html[data-app-booting] #app { visibility: hidden; opacity: 0; }
            html[data-skip-boot-veil] #boot-veil { display: none !important; }
            /* Plain anti-FOUC cover. The animated splash lives in the home loader
               (GSAP) — the veil must NOT duplicate it, just fade out once ready. */
            #boot-veil {
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              background: #07070a;
              transition: opacity 0.35s ease;
            }
            #boot-veil[data-hiding="true"] {
              opacity: 0;
              pointer-events: none;
            }
          `}</style>
          <script>{`
            try {
              if (sessionStorage.getItem("melostudio_loaded")) {
                document.documentElement.removeAttribute("data-app-booting");
                document.documentElement.setAttribute("data-skip-boot-veil", "");
              }
            } catch {}
          `}</script>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Great+Vibes&display=swap"
            rel="stylesheet"
          />
          <link rel="icon" type="image/svg+xml" href="/Icon.svg" />
          <title>MeloStudio</title>
          {assets}
        </head>
        <body>
          <div id="boot-veil" aria-hidden="true"></div>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
