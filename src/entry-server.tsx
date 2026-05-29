import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-app-booting="">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#030303" />
          <style>{`
            html, body, #app { min-height: 100%; }
            body { margin: 0; background: #030303; color: #f4f1ea; }
            html[data-app-booting] #app { visibility: hidden; opacity: 0; }
            #boot-veil {
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              display: grid;
              place-items: center;
              gap: 1rem;
              align-content: center;
              background: #030303;
              color: #f4f1ea;
              transition: opacity 220ms ease;
            }
            #boot-veil[data-hiding="true"] {
              opacity: 0;
              pointer-events: none;
            }
            .boot-veil__mark {
              display: flex;
              align-items: baseline;
              gap: 0.18em;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: clamp(1.5rem, 5vw, 3.25rem);
              font-weight: 800;
              letter-spacing: 0;
            }
            .boot-veil__mark span { color: #40f3ec; text-transform: uppercase; }
            .boot-veil__mark strong { font-family: cursive; font-size: 1.2em; font-weight: 400; }
            .boot-veil__bar {
              width: min(14rem, 52vw);
              height: 1px;
              overflow: hidden;
              background: rgba(255, 255, 255, 0.1);
            }
            .boot-veil__bar::before {
              content: "";
              display: block;
              width: 45%;
              height: 100%;
              background: #40f3ec;
              animation: boot-veil-scan 1.05s ease-in-out infinite;
            }
            @keyframes boot-veil-scan {
              0% { transform: translateX(-110%); }
              100% { transform: translateX(250%); }
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
            <div class="boot-veil__mark"><span>Melo</span><strong>Studio</strong></div>
            <div class="boot-veil__bar" />
          </div>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
