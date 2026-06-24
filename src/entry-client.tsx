// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { waitForVisualReady, waitForAllStylesheets } from "~/lib/client/visualReady";

function appRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) throw new Error("#app root element is missing");
	return root;
}

let revealed = false;

function revealApp() {
	if (revealed) return;
	revealed = true;

	// On a fresh visit the boot veil plays a ~1.4s intro animation; hold it on
	// screen until that finishes so it never gets cut off mid-animation.
	// Repeat visits skip the veil entirely, so reveal immediately.
	const skip = document.documentElement.hasAttribute("data-skip-boot-veil");
	const minVeilMs = skip ? 0 : 1700;

	waitForVisualReady({ frames: 2, stylesheetsMaxWait: 2800, totalMaxWait: 3000 })
		.then(() => waitForAllStylesheets(1500, 60))
		.then(() => {
			// performance.now() ≈ ms since navigation start, so this keeps the veil
			// up for at least minVeilMs total regardless of how fast content loaded.
			const wait = Math.max(0, minVeilMs - performance.now());
			window.setTimeout(() => {
				const bootVeil = document.getElementById("boot-veil");
				// Reveal the app underneath first, then fade the veil out over it.
				document.documentElement.removeAttribute("data-app-booting");
				document.documentElement.removeAttribute("data-skip-boot-veil");
				try { sessionStorage.setItem("melostudio_loaded", "1"); }
				catch {}
				if (bootVeil) {
					bootVeil.setAttribute("data-hiding", "true");
					window.setTimeout(() => bootVeil.remove(), 600);
				}
			}, wait);
		});
}

mount(() => <StartClient />, appRoot());

document.addEventListener("app:content-ready", revealApp, { once: true });
// Hard-timeout fallback: if the app:content-ready event never fires (SSR mismatch, script error) the veil still lifts
window.setTimeout(revealApp, 5000);

export default function() {}
