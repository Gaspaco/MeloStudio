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
              min-height: 100%;
              background: #07070a;
            }
            html {
              min-height: 100vh;
              min-height: 100dvh;
              color-scheme: dark;
            }
            body {
              margin: 0;
              min-height: 100vh;
              min-height: 100dvh;
              background: #07070a;
              color: #f4f1ea;
            }
            html[data-app-booting] #app { visibility: hidden; opacity: 0; }
            html:not([data-app-booting]) #boot-veil,
            html[data-skip-boot-veil] #boot-veil { display: none !important; }
            #boot-veil {
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              background: #07070a;
              visibility: visible;
            }
            #boot-veil .loader {
              position: absolute;
              inset: 0;
              background: #07070a;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }
            #boot-veil .loader__melo {
              font-family: Syne, system-ui, sans-serif;
              font-size: clamp(6rem, 18vw, 22rem);
              font-weight: 800;
              letter-spacing: -0.05em;
              text-transform: uppercase;
              line-height: 0.85;
              padding-bottom: 0.15em;
              margin-bottom: -0.15em;
              color: #e05297;
              overflow: hidden;
              display: inline-block;
            }
            #boot-veil .loader__studio {
              font-family: "Great Vibes", cursive;
              font-size: clamp(3rem, 9vw, 11rem);
              font-weight: 400;
              line-height: 1;
              color: #f4f1ea;
              margin-top: -0.15em;
              overflow: hidden;
              display: inline-block;
              align-self: flex-end;
              margin-right: 12vw;
            }
            #boot-veil .loader__char {
              display: inline-block;
              opacity: 0;
              will-change: transform, opacity;
            }
            #boot-veil .loader__melo .loader__char {
              transform: translateY(120%);
              animation: bootMeloChar 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            #boot-veil .loader__studio .loader__char {
              transform: translateX(80%);
              animation: bootStudioChar 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            #boot-veil .loader__melo .loader__char:nth-child(1) { animation-delay: 120ms; }
            #boot-veil .loader__melo .loader__char:nth-child(2) { animation-delay: 200ms; }
            #boot-veil .loader__melo .loader__char:nth-child(3) { animation-delay: 280ms; }
            #boot-veil .loader__melo .loader__char:nth-child(4) { animation-delay: 360ms; }
            #boot-veil .loader__studio .loader__char:nth-child(1) { animation-delay: 520ms; }
            #boot-veil .loader__studio .loader__char:nth-child(2) { animation-delay: 570ms; }
            #boot-veil .loader__studio .loader__char:nth-child(3) { animation-delay: 620ms; }
            #boot-veil .loader__studio .loader__char:nth-child(4) { animation-delay: 670ms; }
            #boot-veil .loader__studio .loader__char:nth-child(5) { animation-delay: 720ms; }
            #boot-veil .loader__studio .loader__char:nth-child(6) { animation-delay: 770ms; }
            @keyframes bootMeloChar {
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes bootStudioChar {
              to { transform: translateX(0); opacity: 1; }
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
          <div id="boot-veil" aria-hidden="true">
            <div class="loader">
              <div class="loader__melo">
                <span class="loader__char">M</span>
                <span class="loader__char">E</span>
                <span class="loader__char">L</span>
                <span class="loader__char">O</span>
              </div>
              <div class="loader__studio">
                <span class="loader__char">S</span>
                <span class="loader__char">t</span>
                <span class="loader__char">u</span>
                <span class="loader__char">d</span>
                <span class="loader__char">i</span>
                <span class="loader__char">o</span>
              </div>
            </div>
          </div>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
