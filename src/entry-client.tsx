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

	waitForVisualReady({ frames: 2, stylesheetsMaxWait: 2800, totalMaxWait: 3000 })
		.then(() => waitForAllStylesheets(1500, 60))
		.then(() => {
			const bootVeil = document.getElementById("boot-veil");
			bootVeil?.remove();
			document.documentElement.removeAttribute("data-app-booting");
			document.documentElement.removeAttribute("data-skip-boot-veil");
			try { sessionStorage.setItem("melostudio_loaded", "1"); }
			catch {}
		});
}

mount(() => <StartClient />, appRoot());

document.addEventListener("app:content-ready", revealApp, { once: true });
// Hard-timeout fallback: if the app:content-ready event never fires (SSR mismatch, script error) the veil still lifts
window.setTimeout(revealApp, 5000);

export default function() {}
