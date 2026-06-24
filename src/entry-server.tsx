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
            #boot-veil {
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              background: #07070a;
              display: grid;
              place-items: center;
              transition: opacity 0.35s ease;
            }
            #boot-veil-logo {
              display: flex;
              align-items: baseline;
              gap: 0.55rem;
              color: #f4f1ea;
              opacity: 1;
            }
            #boot-veil-melo {
              color: #e05297;
              font-family: "Syne", system-ui, sans-serif;
              font-size: clamp(2.5rem, 8vw, 7rem);
              font-weight: 800;
              line-height: 0.85;
              letter-spacing: -0.04em;
            }
            #boot-veil-studio {
              font-family: "Great Vibes", cursive;
              font-size: clamp(1.45rem, 4vw, 3.5rem);
              line-height: 1;
            }
            #boot-veil[data-hiding="true"] {
              opacity: 0;
              pointer-events: none;
            }
          `}</style>
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
          <div id="boot-veil" aria-hidden="true">
            <div id="boot-veil-logo">
              <span id="boot-veil-melo">MELO</span>
              <span id="boot-veil-studio">Studio</span>
            </div>
          </div>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
