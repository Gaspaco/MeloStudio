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

	const bootVeil = document.getElementById("boot-veil");
	const alreadySkipped = document.documentElement.hasAttribute("data-skip-boot-veil");

	if (alreadySkipped) {
		document.documentElement.removeAttribute("data-app-booting");
		document.documentElement.removeAttribute("data-skip-boot-veil");
		bootVeil?.remove();
		return;
	}

	waitForVisualReady({ frames: 2, stylesheetsMaxWait: 2800, totalMaxWait: 3000 })
		.then(() => waitForAllStylesheets(1500, 60))
		.then(() => {
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
window.setTimeout(revealApp, 5000);

export default function() {}
