import type { Component } from "solid-js";

const Footer: Component<{
  footerRef: (el: HTMLElement) => void;
}> = (props) => {
  return (
    <footer ref={props.footerRef} class="footer">
      <div class="footer__info">
        <span class="footer__back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          &uarr; back to top
        </span>
        <div class="footer__links">
          <span class="footer__accent">timeline</span>
          <span>mixer</span>
          <span class="footer__accent">engine</span>
          <span>cloud sync</span>
        </div>
        <div class="footer__links">
          <span>privacy policy</span>
          <span>terms</span>
        </div>
        <div class="footer__right">
          <span>&copy; 2026 MeloStudio</span>
          <span>design &amp; dev</span>
        </div>
      </div>
      <div class="footer__brand">
        <span class="footer__brand-line">Melo</span>
        <span class="footer__brand-line">Studio</span>
      </div>
    </footer>
  );
};

export default Footer;
