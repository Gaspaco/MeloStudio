import { type Component, createSignal } from "solid-js";

type Step = "prompt" | "requesting" | "denied" | "granted";

interface MicSetupModalProps {
  onGranted: () => void;
  onClose: () => void;
}

const MicSetupModal: Component<MicSetupModalProps> = (props) => {
  const [step, setStep] = createSignal<Step>("prompt");

  const requestAccess = async () => {
    setStep("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the test stream immediately — the actual track will open its own
      stream.getTracks().forEach(t => t.stop());
      setStep("granted");
      setTimeout(() => {
        props.onGranted();
      }, 900);
    } catch {
      setStep("denied");
    }
  };

  return (
    <div class="bl__overlay" onClick={props.onClose}>
      <div class="bl__modal bl__modal--mic" onClick={(e) => e.stopPropagation()}>
        <button class="bl__modal-close" onClick={props.onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>

        {step() === "prompt" && (
          <>
            <div class="bl__mic-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
              </svg>
            </div>
            <div class="bl__modal-hero">
              <span class="bl__modal-eyebrow">— Microphone Access</span>
              <h2>Enable your mic<br/>to record audio</h2>
              <p>MeloStudio needs access to your microphone to capture vocals, instruments, or any live audio input.</p>
            </div>
            <div class="bl__mic-actions">
              <button class="bl__mic-btn bl__mic-btn--allow" onClick={requestAccess}>
                Allow microphone
              </button>
              <button class="bl__mic-btn bl__mic-btn--cancel" onClick={props.onClose}>
                Not now
              </button>
            </div>
          </>
        )}

        {step() === "requesting" && (
          <>
            <div class="bl__mic-icon bl__mic-icon--pulse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/>
                <path d="M5 10a7 7 0 0 0 14 0"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
              </svg>
            </div>
            <div class="bl__modal-hero">
              <h2>Waiting for<br/>permission…</h2>
              <p>Allow microphone access in your browser's popup to continue.</p>
            </div>
          </>
        )}

        {step() === "granted" && (
          <>
            <div class="bl__mic-icon bl__mic-icon--granted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="bl__modal-hero">
              <h2>Mic is live</h2>
              <p>Your voice track is ready to record.</p>
            </div>
          </>
        )}

        {step() === "denied" && (
          <>
            <div class="bl__mic-icon bl__mic-icon--denied">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <div class="bl__modal-hero">
              <h2>Access denied</h2>
              <p>To fix this, click the lock icon in your browser's address bar and allow microphone access for this site, then try again.</p>
            </div>
            <div class="bl__mic-actions">
              <button class="bl__mic-btn bl__mic-btn--allow" onClick={requestAccess}>
                Try again
              </button>
              <button class="bl__mic-btn bl__mic-btn--cancel" onClick={props.onClose}>
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MicSetupModal;
