export default function PrivacyPage() {
  return (
    <main style={{ "max-width": "780px", margin: "0 auto", padding: "4rem 2rem", "font-family": "system-ui, sans-serif", color: "#e8e8e8", background: "#0d0d0d", "min-height": "100vh", "line-height": "1.7" }}>
      <a href="/" style={{ color: "#e040a0", "text-decoration": "none", "font-size": "0.875rem" }}>← melostudio.app</a>
      <h1 style={{ "font-size": "2rem", "font-weight": "700", margin: "2rem 0 0.5rem" }}>Privacy Policy</h1>
      <p style={{ color: "#888", "font-size": "0.875rem", "margin-bottom": "2.5rem" }}>Last updated: May 6, 2026</p>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>1. Information We Collect</h2>
        <p>When you sign in with a social provider (Google, Meta, X/Twitter) we receive your name, email address, and profile picture as provided by that platform. We store this information to create and maintain your MeloStudio account.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>2. How We Use Your Information</h2>
        <p>We use your information solely to:</p>
        <ul style={{ "padding-left": "1.5rem", "margin-top": "0.5rem" }}>
          <li>Authenticate you and maintain your session</li>
          <li>Associate your music projects with your account</li>
          <li>Send transactional emails (password reset, etc.)</li>
        </ul>
        <p style={{ "margin-top": "0.75rem" }}>We do not sell, rent, or share your personal data with third parties for marketing purposes.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>3. Data Storage</h2>
        <p>Your data is stored in a secured Neon Postgres database hosted on AWS (EU Central 1). All connections are encrypted in transit (TLS) and at rest.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>4. Third-Party Sign-In</h2>
        <p>When you use Google, Meta, or X to sign in, you are subject to their respective privacy policies. We only request the minimum scopes needed for authentication (name, email, and profile picture).</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>5. Data Deletion</h2>
        <p>You can request deletion of all your personal data at any time. Visit our <a href="/data-deletion" style={{ color: "#e040a0" }}>Data Deletion page</a> for instructions, or email <a href="mailto:privacy@melostudio.app" style={{ color: "#e040a0" }}>privacy@melostudio.app</a>. We will process your request within 30 days.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>6. Cookies</h2>
        <p>We use a single session cookie to keep you logged in. No tracking or advertising cookies are used.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>7. Contact</h2>
        <p>Questions about this policy? Email <a href="mailto:privacy@melostudio.app" style={{ color: "#e040a0" }}>privacy@melostudio.app</a>.</p>
      </section>
    </main>
  );
}
