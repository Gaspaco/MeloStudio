// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { waitForVisualReady } from "~/lib/client/visualReady";

function appRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) throw new Error("#app root element is missing");
	return root;
}

let revealed = false;

function revealApp() {
	if (revealed) return;
	revealed = true;

	waitForVisualReady({ frames: 1, stylesheetsMaxWait: 250, totalMaxWait: 300 })
		.finally(() => {
			const bootVeil = document.getElementById("boot-veil");
			// Splash shows once per session (any first page). The boot veil is the
			// only loading screen now, so mark it seen everywhere.
			try { sessionStorage.setItem("melostudio_loaded", "1"); }
			catch {}
			document.documentElement.removeAttribute("data-app-booting");
			document.documentElement.removeAttribute("data-skip-boot-veil");
			if (bootVeil) {
				bootVeil.setAttribute("data-hiding", "true");
				// Match the 0.35s opacity transition so it fades fully before removal.
				window.setTimeout(() => bootVeil.remove(), 400);
			}
		});
}

mount(() => <StartClient />, appRoot());

document.addEventListener("app:content-ready", revealApp, { once: true });
// If hydration fails to emit readiness, never leave the page covered indefinitely.
window.setTimeout(revealApp, 1000);

export default function() {}
