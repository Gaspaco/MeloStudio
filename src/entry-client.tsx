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

	// The boot veil is just a plain anti-FOUC cover — the actual MELO Studio
	// splash animation is owned by the home loader (GSAP). So reveal the app as
	// soon as it's ready and fade the cover out; no artificial hold.
	waitForVisualReady({ frames: 2, stylesheetsMaxWait: 2800, totalMaxWait: 3000 })
		.then(() => waitForAllStylesheets(1500, 60))
		.then(() => {
			const bootVeil = document.getElementById("boot-veil");
			document.documentElement.removeAttribute("data-app-booting");
			document.documentElement.removeAttribute("data-skip-boot-veil");
			if (bootVeil) {
				bootVeil.setAttribute("data-hiding", "true");
				window.setTimeout(() => bootVeil.remove(), 400);
			}
		});
}

mount(() => <StartClient />, appRoot());

document.addEventListener("app:content-ready", revealApp, { once: true });
// Hard-timeout fallback: if the app:content-ready event never fires (SSR mismatch, script error) the veil still lifts
window.setTimeout(revealApp, 5000);

export default function() {}
