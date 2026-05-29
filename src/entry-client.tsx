// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { waitForVisualReady } from "~/lib/client/visualReady";

function appRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) throw new Error("#app root element is missing");
	return root;
}

async function revealWhenStyled() {
	await waitForVisualReady({ frames: 2, stylesheetsMaxWait: 2800, totalMaxWait: 3000 });

	const bootVeil = document.getElementById("boot-veil");
	document.documentElement.removeAttribute("data-app-booting");
	if (bootVeil) {
		bootVeil.setAttribute("data-hiding", "true");
		window.setTimeout(() => bootVeil.remove(), 260);
	}
}

mount(() => <StartClient />, appRoot());
void revealWhenStyled();
export default function() {}
