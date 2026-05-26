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

function waitForStylesheets(): Promise<void> {
	const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
	const waits = links
		.filter((link) => !link.sheet)
		.map((link) => new Promise<void>((resolve) => {
			link.addEventListener("load", () => resolve(), { once: true });
			link.addEventListener("error", () => resolve(), { once: true });
		}));
	return Promise.all(waits).then(() => undefined);
}

async function revealWhenStyled() {
	await nextFrame();
	await nextFrame();
	const fontsReady = "fonts" in document ? document.fonts.ready.then(() => undefined).catch(() => undefined) : Promise.resolve();
	await Promise.race([
		Promise.all([waitForStylesheets(), fontsReady]),
		new Promise<void>((resolve) => setTimeout(resolve, 1800)),
	]);
	document.documentElement.removeAttribute("data-app-booting");
}

mount(() => <StartClient />, appRoot());
void revealWhenStyled();
export default function() {}
