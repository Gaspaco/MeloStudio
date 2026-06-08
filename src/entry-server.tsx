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
              background: #030303;
              transition: opacity 220ms ease;
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
          <div id="boot-veil" aria-hidden="true"></div>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
