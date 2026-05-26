// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

function appRoot(): HTMLElement {
	const root = document.getElementById("app");
	if (!root) throw new Error("#app root element is missing");
	return root;
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for every <link rel="stylesheet"> to have its sheet parsed —
 * including ones Vite injects *after* the initial parse (route CSS chunks).
 * A MutationObserver keeps watching head for new link tags so nothing is missed.
 * Hard cap of `maxWait` ms so slow networks never stall the reveal forever.
 */
function waitForAllStylesheets(maxWait = 3000): Promise<void> {
	return new Promise<void>((resolve) => {
		const timer = setTimeout(done, maxWait);

		function done() {
			clearTimeout(timer);
			observer.disconnect();
			resolve();
		}

		function check() {
			const links = Array.from(
				document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
			);
			const pending = links.filter(
				(l) => !l.sheet && !(l as any)._foucFailed,
			);

			if (pending.length === 0) { done(); return; }

			for (const link of pending) {
				if ((link as any)._foucWatching) continue;
				(link as any)._foucWatching = true;
				link.addEventListener("load", check, { once: true });
				link.addEventListener("error", () => {
					(link as any)._foucFailed = true;
					check();
				}, { once: true });
			}
		}

		// Watch head for any <link> tags Vite injects when a JS chunk loads.
		const observer = new MutationObserver(check);
		observer.observe(document.head, { childList: true, subtree: true });
		check();
	});
}

async function revealWhenStyled() {
	// Give SolidJS two frames to mount + trigger route CSS injection.
	await nextFrame();
	await nextFrame();

	const fontsReady = "fonts" in document
		? document.fonts.ready.then(() => undefined).catch(() => undefined)
		: Promise.resolve();

	// Wait for all stylesheets (including lazily-injected route chunks) AND
	// fonts, but never block the reveal for more than 3 seconds total.
	await Promise.race([
		Promise.all([waitForAllStylesheets(2800), fontsReady]),
		new Promise<void>((resolve) => setTimeout(resolve, 3000)),
	]);

	document.documentElement.removeAttribute("data-app-booting");
}

mount(() => <StartClient />, appRoot());
void revealWhenStyled();
export default function() {}
