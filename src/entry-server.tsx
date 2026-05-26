import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-app-booting="">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>{`
            html, body, #app { min-height: 100%; }
            body { margin: 0; background: #030303; color: #f4f1ea; }
            html[data-app-booting] #app { visibility: hidden; }
            html[data-app-booting] body::before {
              content: "";
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              background: #030303;
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
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
