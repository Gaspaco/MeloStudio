// Static public instructions for removing account data and social-app access.
export default function DataDeletionPage() {
  return (
    <main style={{ "max-width": "780px", margin: "0 auto", padding: "4rem 2rem", "font-family": "system-ui, sans-serif", color: "var(--theme-text, #e8e8e8)", background: "var(--theme-page-bg, #0d0d0d)", "min-height": "100vh", "line-height": "1.7" }}>
      <a href="/login" style={{ color: "#e040a0", "text-decoration": "none", "font-size": "0.875rem" }}>← Sign in</a>
      <h1 style={{ "font-size": "2rem", "font-weight": "700", margin: "2rem 0 0.5rem" }}>Data Deletion</h1>
      <p style={{ color: "var(--theme-text-muted, #888)", "font-size": "0.875rem", "margin-bottom": "2.5rem" }}>How to request removal of your MeloStudio data</p>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>Delete your account</h2>
        <p>To permanently delete all data associated with your MeloStudio account (projects, settings, and profile information), send an email to:</p>
        <p style={{ "margin-top": "1rem" }}>
          <a href="mailto:privacy@melostudio.app?subject=Data%20Deletion%20Request" style={{ color: "#e040a0", "font-size": "1.05rem", "font-weight": "600" }}>privacy@melostudio.app</a>
        </p>
        <p style={{ "margin-top": "1rem" }}>Include the email address or username associated with your account. We will confirm deletion within <strong>30 days</strong>.</p>
      </section>

      <section style={{ "margin-bottom": "2rem" }}>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>What gets deleted</h2>
        <ul style={{ "padding-left": "1.5rem" }}>
          <li>Your account profile (name, email, avatar)</li>
          <li>All music projects and associated files</li>
          <li>Session data and authentication tokens</li>
        </ul>
      </section>

      <section>
        <h2 style={{ "font-size": "1.15rem", "font-weight": "600", "margin-bottom": "0.75rem" }}>Signed in with Meta?</h2>
        <p>If you signed in using your Facebook account, you can also revoke MeloStudio's access directly from Facebook:</p>
        <ol style={{ "padding-left": "1.5rem", "margin-top": "0.5rem" }}>
          <li>Open Facebook → <strong>Settings &amp; Privacy</strong> → <strong>Settings</strong></li>
          <li>Go to <strong>Apps and Websites</strong></li>
          <li>Find <strong>MeloStudio</strong> and click <strong>Remove</strong></li>
        </ol>
        <p style={{ "margin-top": "0.75rem" }}>This revokes access but does not delete your MeloStudio account data. Email us at the address above to delete your data as well.</p>
      </section>
    </main>
  );
}
