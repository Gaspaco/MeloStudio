import { type Component, createSignal, createResource, Show, For, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authClient } from "../../lib/auth";
import { getAppSession, signOutApp } from "../../lib/app-auth";
import { setAppLanguage } from "../../lib/i18n";
import "./settings.scss";

type Section = "profile" | "account" | "security" | "notifications" | "privacy" | "linked" | "appearance" | "language";

const Settings: Component = () => {
  const navigate = useNavigate();
  const [section, setSection] = createSignal<Section>("profile");

  const [user, setUser] = createSignal<{
    name?: string;
    email?: string;
    image?: string;
  } | null>(null);

  const [profileName, setProfileName] = createSignal("");
  const [profileBio, setProfileBio] = createSignal("");
  const [profileInstagram, setProfileInstagram] = createSignal("");
  const [profileTwitter, setProfileTwitter] = createSignal("");
  const [profileWebsite, setProfileWebsite] = createSignal("");
  const [profileSaving, setProfileSaving] = createSignal(false);
  const [profileSaved, setProfileSaved] = createSignal(false);
  const [profileSpotify, setProfileSpotify] = createSignal("");
  const [profileYoutube, setProfileYoutube] = createSignal("");

  // ── Music Interests ──
  const TALENTS = ["Guitarist", "Keyboardist", "Drummer", "Vocalist", "Songwriter", "Bass Player", "DJ/Beatmaker", "Producer", "Rapper", "Other"];
  const GENRES = ["Rock", "Pop", "Hip Hop", "R&B & Soul", "Electronic", "Jazz", "Folk", "Latin", "Classical", "Funk", "Blues", "Metal", "Country", "Reggae", "K-Pop", "Afro", "House", "Dance & EDM", "Trap", "Punk", "Lo-fi", "Dancehall"];

  const loadSet = (key: string): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { return new Set(); }
  };
  const saveSet = (key: string, s: Set<string>) => localStorage.setItem(key, JSON.stringify([...s]));

  const [selectedTalents, setSelectedTalents] = createSignal<Set<string>>(loadSet("ms_talents"));
  const [selectedGenres, setSelectedGenres] = createSignal<Set<string>>(loadSet("ms_genres"));
  const [inspiredBy, setInspiredBy] = createSignal<string[]>(JSON.parse(localStorage.getItem("ms_inspired") ?? "[]"));
  const [artistInput, setArtistInput] = createSignal("");

  const toggleChip = (key: string, getter: () => Set<string>, setter: (s: Set<string>) => void, val: string) => {
    const next = new Set(getter());
    if (next.has(val)) next.delete(val); else next.add(val);
    setter(next);
    saveSet(key, next);
  };

  const addArtist = () => {
    const name = artistInput().trim();
    if (!name || inspiredBy().includes(name)) return;
    const next = [...inspiredBy(), name];
    setInspiredBy(next);
    localStorage.setItem("ms_inspired", JSON.stringify(next));
    setArtistInput("");
  };

  const removeArtist = (name: string) => {
    const next = inspiredBy().filter(a => a !== name);
    setInspiredBy(next);
    localStorage.setItem("ms_inspired", JSON.stringify(next));
  };

  type ArtistSuggestion = { name: string; image: string };
  const [artistSuggestions, setArtistSuggestions] = createSignal<ArtistSuggestion[]>([]);
  let artistSearchTimer: ReturnType<typeof setTimeout> | undefined;

  const searchArtists = (query: string) => {
    clearTimeout(artistSearchTimer);
    setArtistInput(query);
    if (query.trim().length < 2) { setArtistSuggestions([]); return; }
    artistSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=6`);
        const data = await res.json();
        const seen = new Set<string>();
        const results: ArtistSuggestion[] = [];
        for (const r of data.results ?? []) {
          const name = r.artistName as string;
          if (seen.has(name) || inspiredBy().includes(name)) continue;
          seen.add(name);
          results.push({ name, image: (r.artworkUrl100 ?? r.artworkUrl60 ?? "") as string });
        }
        setArtistSuggestions(results);
      } catch { setArtistSuggestions([]); }
    }, 300);
  };

  const pickArtist = (name: string) => {
    if (inspiredBy().includes(name)) return;
    const next = [...inspiredBy(), name];
    setInspiredBy(next);
    localStorage.setItem("ms_inspired", JSON.stringify(next));
    setArtistInput("");
    setArtistSuggestions([]);
  };

  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [passwordError, setPasswordError] = createSignal("");
  const [passwordSaved, setPasswordSaved] = createSignal(false);

  const [deleteStep, setDeleteStep] = createSignal<"none" | "confirm">("none");

  const [accountEmail, setAccountEmail] = createSignal("");
  const [accountDob, setAccountDob] = createSignal(localStorage.getItem("ms_dob") ?? "");
  const [accountGender, setAccountGender] = createSignal(localStorage.getItem("ms_gender") ?? "");
  const [accountSaving, setAccountSaving] = createSignal(false);
  const [accountSaved, setAccountSaved] = createSignal(false);
  const [langSaved, setLangSaved] = createSignal(false);

  // ── Helpers ──
  const loadBool = (key: string, def: boolean) => {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "1";
  };
  const saveBool = (key: string, val: boolean) => localStorage.setItem(key, val ? "1" : "0");

  // ── Notifications ──
  const [notifLikes, setNotifLikes] = createSignal(loadBool("ms_notif_likes", true));
  const [notifComments, setNotifComments] = createSignal(loadBool("ms_notif_comments", true));
  const [notifFollows, setNotifFollows] = createSignal(loadBool("ms_notif_follows", true));
  const [notifMentions, setNotifMentions] = createSignal(loadBool("ms_notif_mentions", true));
  const [notifCollabs, setNotifCollabs] = createSignal(loadBool("ms_notif_collabs", true));
  const [notifEmail, setNotifEmail] = createSignal(loadBool("ms_notif_email", false));
  const [notifPush, setNotifPush] = createSignal(loadBool("ms_notif_push", true));

  const toggleNotif = (key: string, getter: () => boolean, setter: (v: boolean) => void) => {
    const next = !getter();
    setter(next);
    saveBool(key, next);
  };

  // ── Privacy ──
  const [privateAccount, setPrivateAccount] = createSignal(loadBool("ms_priv_private", false));
  const [allowMessages, setAllowMessages] = createSignal(localStorage.getItem("ms_priv_messages") ?? "everyone");
  const [allowComments, setAllowComments] = createSignal(localStorage.getItem("ms_priv_comments") ?? "everyone");
  const [showActivity, setShowActivity] = createSignal(loadBool("ms_priv_activity", true));
  const [showListeningHistory, setShowListeningHistory] = createSignal(loadBool("ms_priv_history", true));

  // ── Appearance ──
  const [theme, setTheme] = createSignal(localStorage.getItem("ms_theme") ?? "dark");
  const [compactMode, setCompactMode] = createSignal(loadBool("ms_compact", false));

  // ── Language ──
  const [language, setLanguage] = createSignal(localStorage.getItem("ms_lang") ?? "en");
  const copy = {
    en: {
      back: "Back to Dashboard",
      profile: "Profile",
      account: "Account",
      notifications: "Notifications",
      privacy: "Privacy",
      linked: "Linked Accounts",
      security: "Security",
      appearance: "Appearance",
      language: "Language",
      appearanceDesc: "Customize how MeloStudio looks.",
      theme: "Theme",
      dark: "Dark",
      light: "Light",
      system: "System",
      layout: "Layout",
      compactMode: "Compact Mode",
      compactDesc: "Reduce spacing and make elements smaller",
      languageDesc: "Choose your preferred language for MeloStudio.",
      displayLanguage: "Display Language",
      languageSaved: "Language preference saved!",
    },
    es: {
      back: "Volver al panel",
      profile: "Perfil",
      account: "Cuenta",
      notifications: "Notificaciones",
      privacy: "Privacidad",
      linked: "Cuentas vinculadas",
      security: "Seguridad",
      appearance: "Apariencia",
      language: "Idioma",
      appearanceDesc: "Personaliza como se ve MeloStudio.",
      theme: "Tema",
      dark: "Oscuro",
      light: "Claro",
      system: "Sistema",
      layout: "Diseño",
      compactMode: "Modo compacto",
      compactDesc: "Reduce el espaciado y hace los elementos más pequeños",
      languageDesc: "Elige tu idioma preferido para MeloStudio.",
      displayLanguage: "Idioma de pantalla",
      languageSaved: "Preferencia de idioma guardada.",
    },
    fr: {
      back: "Retour au tableau",
      profile: "Profil",
      account: "Compte",
      notifications: "Notifications",
      privacy: "Confidentialité",
      linked: "Comptes liés",
      security: "Sécurité",
      appearance: "Apparence",
      language: "Langue",
      appearanceDesc: "Personnalisez l'apparence de MeloStudio.",
      theme: "Thème",
      dark: "Sombre",
      light: "Clair",
      system: "Système",
      layout: "Mise en page",
      compactMode: "Mode compact",
      compactDesc: "Réduit l'espacement et rend les éléments plus petits",
      languageDesc: "Choisissez votre langue préférée pour MeloStudio.",
      displayLanguage: "Langue d'affichage",
      languageSaved: "Préférence de langue enregistrée.",
    },
    de: {
      back: "Zurück zum Dashboard",
      profile: "Profil",
      account: "Konto",
      notifications: "Benachrichtigungen",
      privacy: "Datenschutz",
      linked: "Verknüpfte Konten",
      security: "Sicherheit",
      appearance: "Darstellung",
      language: "Sprache",
      appearanceDesc: "Passe an, wie MeloStudio aussieht.",
      theme: "Design",
      dark: "Dunkel",
      light: "Hell",
      system: "System",
      layout: "Layout",
      compactMode: "Kompaktmodus",
      compactDesc: "Verringert Abstände und macht Elemente kleiner",
      languageDesc: "Wähle deine bevorzugte Sprache für MeloStudio.",
      displayLanguage: "Anzeigesprache",
      languageSaved: "Spracheinstellung gespeichert.",
    },
    pt: {
      back: "Voltar ao painel",
      profile: "Perfil",
      account: "Conta",
      notifications: "Notificações",
      privacy: "Privacidade",
      linked: "Contas conectadas",
      security: "Segurança",
      appearance: "Aparência",
      language: "Idioma",
      appearanceDesc: "Personalize a aparência do MeloStudio.",
      theme: "Tema",
      dark: "Escuro",
      light: "Claro",
      system: "Sistema",
      layout: "Layout",
      compactMode: "Modo compacto",
      compactDesc: "Reduz o espaçamento e deixa os elementos menores",
      languageDesc: "Escolha seu idioma preferido para o MeloStudio.",
      displayLanguage: "Idioma de exibição",
      languageSaved: "Preferência de idioma salva.",
    },
    ja: {
      back: "ダッシュボードに戻る",
      profile: "プロフィール",
      account: "アカウント",
      notifications: "通知",
      privacy: "プライバシー",
      linked: "連携アカウント",
      security: "セキュリティ",
      appearance: "外観",
      language: "言語",
      appearanceDesc: "MeloStudio の見た目をカスタマイズします。",
      theme: "テーマ",
      dark: "ダーク",
      light: "ライト",
      system: "システム",
      layout: "レイアウト",
      compactMode: "コンパクトモード",
      compactDesc: "余白を減らして要素を小さく表示します",
      languageDesc: "MeloStudio で使う言語を選択します。",
      displayLanguage: "表示言語",
      languageSaved: "言語設定を保存しました。",
    },
    ko: {
      back: "대시보드로 돌아가기",
      profile: "프로필",
      account: "계정",
      notifications: "알림",
      privacy: "개인정보",
      linked: "연결된 계정",
      security: "보안",
      appearance: "화면 설정",
      language: "언어",
      appearanceDesc: "MeloStudio의 표시 방식을 설정합니다.",
      theme: "테마",
      dark: "다크",
      light: "라이트",
      system: "시스템",
      layout: "레이아웃",
      compactMode: "컴팩트 모드",
      compactDesc: "간격을 줄이고 요소를 더 작게 표시합니다",
      languageDesc: "MeloStudio에서 사용할 언어를 선택하세요.",
      displayLanguage: "표시 언어",
      languageSaved: "언어 설정이 저장되었습니다.",
    },
    zh: {
      back: "返回仪表板",
      profile: "个人资料",
      account: "账号",
      notifications: "通知",
      privacy: "隐私",
      linked: "已关联账号",
      security: "安全",
      appearance: "外观",
      language: "语言",
      appearanceDesc: "自定义 MeloStudio 的显示方式。",
      theme: "主题",
      dark: "深色",
      light: "浅色",
      system: "跟随系统",
      layout: "布局",
      compactMode: "紧凑模式",
      compactDesc: "减少间距，让元素显示得更小",
      languageDesc: "选择 MeloStudio 的首选语言。",
      displayLanguage: "显示语言",
      languageSaved: "语言偏好已保存。",
    },
    ru: {
      back: "Назад к панели",
      profile: "Профиль",
      account: "Аккаунт",
      notifications: "Уведомления",
      privacy: "Конфиденциальность",
      linked: "Связанные аккаунты",
      security: "Безопасность",
      appearance: "Внешний вид",
      language: "Язык",
      appearanceDesc: "Настройте внешний вид MeloStudio.",
      theme: "Тема",
      dark: "Темная",
      light: "Светлая",
      system: "Системная",
      layout: "Макет",
      compactMode: "Компактный режим",
      compactDesc: "Уменьшает отступы и размер элементов",
      languageDesc: "Выберите предпочитаемый язык MeloStudio.",
      displayLanguage: "Язык интерфейса",
      languageSaved: "Языковые настройки сохранены.",
    },
    ar: {
      back: "العودة إلى لوحة التحكم",
      profile: "الملف الشخصي",
      account: "الحساب",
      notifications: "الإشعارات",
      privacy: "الخصوصية",
      linked: "الحسابات المرتبطة",
      security: "الأمان",
      appearance: "المظهر",
      language: "اللغة",
      appearanceDesc: "خصص طريقة ظهور MeloStudio.",
      theme: "السمة",
      dark: "داكن",
      light: "فاتح",
      system: "النظام",
      layout: "التخطيط",
      compactMode: "الوضع المضغوط",
      compactDesc: "تقليل المسافات وجعل العناصر أصغر",
      languageDesc: "اختر لغتك المفضلة في MeloStudio.",
      displayLanguage: "لغة العرض",
      languageSaved: "تم حفظ تفضيل اللغة.",
    },
  } as const;
  type CopyKey = keyof typeof copy.en;
  const t = (key: CopyKey) => copy.en[key];
  const saveLanguage = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    setAppLanguage(nextLanguage);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2500);
  };

  createResource(async () => {
    try {
      const userData = (await getAppSession())?.user;
      if (userData) {
        const rawImage = userData.image ?? undefined;
        const image = rawImage?.replace(/_normal(\.[^.]+)$/, "_400x400$1") ?? rawImage;
        setUser({ name: userData.name, email: userData.email, image });
        setProfileName(userData.name ?? "");
        setAccountEmail(userData.email ?? "");
      }
    } catch {}
  });

  const initials = () => {
    const n = user()?.name ?? "?";
    const parts = n.split(" ");
    return parts.length > 1
      ? ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
      : n.slice(0, 2).toUpperCase();
  };

  const handleImageUpload = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const result = evt.target?.result as string;
      try { await authClient.updateUser({ image: result }); } catch {}
      setUser((u) => (u ? { ...u, image: result } : u));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await authClient.updateUser({ name: profileName() });
      setUser((u) => u ? { ...u, name: profileName() } : u);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {}
    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);
    if (newPassword().length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    try {
      await authClient.changePassword({
        currentPassword: currentPassword(),
        newPassword: newPassword(),
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch {
      setPasswordError("Failed to change password. Check your current password.");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authClient.deleteUser();
      await signOutApp();
      navigate("/login", { replace: true });
    } catch {}
  };

  const handleAccountSave = async () => {
    setAccountSaving(true);
    setAccountSaved(false);
    try {
      localStorage.setItem("ms_dob", accountDob());
      localStorage.setItem("ms_gender", accountGender());
      if (accountEmail() && accountEmail() !== user()?.email) {
        await authClient.changeEmail({ newEmail: accountEmail() });
      }
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 2500);
    } catch {}
    setAccountSaving(false);
  };

  const applyTheme = (t: string) => {
    if (t === "system") {
      const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
      document.documentElement.setAttribute("data-theme", prefersLight ? "light" : "dark");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
  };

  onMount(() => {
    applyTheme(theme());
    document.documentElement.lang = language();
    document.documentElement.dir = language() === "ar" ? "rtl" : "ltr";
  });

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(saveTimer));

  return (
    <div class="st">
      <nav class="st__topbar">
        <span class="st__topbar-logo" aria-label="MeloStudio">
          <span class="st__topbar-melo">Melo</span><span class="st__topbar-studio">Studio</span>
        </span>
      </nav>

      <div class="st__shell">
        {/* Sidebar */}
        <aside class="st__sidebar">
          <a class="st__back" href="/dashboard">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>
            {t("back")}
          </a>

          <div class="st__sidebar-sep" />

          <div class="st__sidebar-nav">
            <button class={`st__sidebar-link${section() === "profile" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("profile")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="7" r="3.5"/><path d="M3 17.5c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/></svg>
              {t("profile")}
            </button>
            <button class={`st__sidebar-link${section() === "account" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("account")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 8h14"/></svg>
              {t("account")}
            </button>
            <button class={`st__sidebar-link${section() === "notifications" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("notifications")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 17c.6 0 1-.4 1-1H9c0 .6.4 1 1 1zm5-3V9.5c0-2.5-1.7-4.6-4-5V4a1 1 0 10-2 0v.5C6.7 4.9 5 7 5 9.5V14l-1 1v.5h12V15l-1-1z"/></svg>
              {t("notifications")}
            </button>
            <button class={`st__sidebar-link${section() === "privacy" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("privacy")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2L3 6v4c0 4.4 3 8.5 7 10 4-1.5 7-5.6 7-10V6l-7-4z"/></svg>
              {t("privacy")}
            </button>
            <button class={`st__sidebar-link${section() === "linked" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("linked")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 12a4 4 0 005.5.4l2-2a4 4 0 00-5.6-5.7L8.5 6.1"/><path d="M12 8a4 4 0 00-5.5-.4l-2 2a4 4 0 005.6 5.7l1.4-1.4"/></svg>
              {t("linked")}
            </button>
            <button class={`st__sidebar-link${section() === "security" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("security")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="9" width="10" height="8" rx="2"/><path d="M7 9V7a3 3 0 0 1 6 0v2"/></svg>
              {t("security")}
            </button>
            <button class={`st__sidebar-link${section() === "appearance" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("appearance")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2.5a7.5 7.5 0 100 15 3.75 3.75 0 010-7.5 3.75 3.75 0 000-7.5z"/></svg>
              {t("appearance")}
            </button>
            <button class={`st__sidebar-link${section() === "language" ? " st__sidebar-link--active" : ""}`} onClick={() => setSection("language")}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c-2 2.5-3 5-3 7.5s1 5 3 7.5M10 2.5c2 2.5 3 5 3 7.5s-1 5-3 7.5"/></svg>
              {t("language")}
            </button>
          </div>
        </aside>

        {/* Content */}
        <main class="st__main">

          {/* ── Profile ── */}
          <Show when={section() === "profile"}>
            <div class="st__section">
              <h1 class="st__section-title">Profile Settings</h1>

              <div class="st__avatar-row">
                <div class="st__avatar-wrap">
                  <input type="file" accept="image/*" onChange={handleImageUpload} class="st__avatar-input" title="Change photo" />
                  <div class="st__avatar">
                    <Show when={user()?.image} keyed fallback={<span class="st__avatar-initials">{initials()}</span>}>
                      {(img) => <img class="st__avatar-img" src={img} alt="" />}
                    </Show>
                  </div>
                  <div class="st__avatar-overlay">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 3H7L5 7H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-3l-2-4z"/><circle cx="10" cy="12" r="3"/></svg>
                  </div>
                </div>
              </div>

              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Name</label>
                  <input class="st__field-input" type="text" value={profileName()} onInput={(e) => setProfileName(e.currentTarget.value)} placeholder="Your name" />
                </div>

                <div class="st__field st__field--locked">
                  <label class="st__field-label">
                    Email
                    <span class="st__field-badge">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="5.5" width="8" height="5.5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>
                    </span>
                  </label>
                  <input class="st__field-input" type="email" value={user()?.email ?? ""} disabled />
                </div>

                <div class="st__field">
                  <label class="st__field-label">About</label>
                  <textarea class="st__field-textarea" value={profileBio()} onInput={(e) => setProfileBio(e.currentTarget.value)} placeholder="Describe yourself in a few words..." rows={4} />
                </div>
              </div>

              <div class="st__divider" />

              {/* ── Music Interests ── */}
              <h2 class="st__subsection-title">Music Interests</h2>

              <h3 class="st__chip-label">Inspired by</h3>
              <div class="st__chip-wrap">
                <For each={inspiredBy()}>{(artist) => (
                  <span class="st__chip st__chip--active">
                    {artist}
                    <button class="st__chip-x" onClick={() => removeArtist(artist)}>
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
                    </button>
                  </span>
                )}</For>
                <div class="st__artist-search">
                  <input
                    class="st__chip-add-input"
                    type="text"
                    value={artistInput()}
                    onInput={(e) => searchArtists(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArtist(); } }}
                    onBlur={() => setTimeout(() => setArtistSuggestions([]), 200)}
                    placeholder="+ Add Artist"
                  />
                  <Show when={artistSuggestions().length > 0}>
                    <div class="st__artist-dropdown">
                      <For each={artistSuggestions()}>{(a) => (
                        <button class="st__artist-option" onMouseDown={() => pickArtist(a.name)}>
                          <Show when={a.image}>
                            <img class="st__artist-option-img" src={a.image} alt="" />
                          </Show>
                          <span>{a.name}</span>
                        </button>
                      )}</For>
                    </div>
                  </Show>
                </div>
              </div>

              <h3 class="st__chip-label">Talents</h3>
              <div class="st__chip-wrap">
                <For each={TALENTS}>{(t) => (
                  <button class={`st__chip${selectedTalents().has(t) ? " st__chip--active" : ""}`} onClick={() => toggleChip("ms_talents", selectedTalents, setSelectedTalents, t)}>
                    {t}
                  </button>
                )}</For>
              </div>

              <h3 class="st__chip-label">Favorite genres</h3>
              <div class="st__chip-wrap">
                <For each={GENRES}>{(g) => (
                  <button class={`st__chip${selectedGenres().has(g) ? " st__chip--active" : ""}`} onClick={() => toggleChip("ms_genres", selectedGenres, setSelectedGenres, g)}>
                    {g}
                  </button>
                )}</For>
              </div>

              <div class="st__divider" />

              {/* ── Links ── */}
              <h2 class="st__subsection-title">Links</h2>

              <div class="st__link-rows">
                <div class="st__link-row">
                  <svg class="st__link-row-icon" viewBox="0 0 24 24" fill="none"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.86 3.9 2.31 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.4-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" fill="currentColor"/></svg>
                  <div class="st__link-row-info">
                    <span class="st__link-row-name">Instagram</span>
                    <span class="st__link-row-status">Connect</span>
                  </div>
                  <svg class="st__link-row-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4l6 6-6 6"/></svg>
                </div>
                <div class="st__link-row">
                  <svg class="st__link-row-icon" viewBox="0 0 24 24" fill="none"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="currentColor"/></svg>
                  <div class="st__link-row-info">
                    <span class="st__link-row-name">YouTube</span>
                    <span class="st__link-row-status">Connect</span>
                  </div>
                  <svg class="st__link-row-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4l6 6-6 6"/></svg>
                </div>
                <div class="st__link-row">
                  <svg class="st__link-row-icon" viewBox="0 0 24 24" fill="none"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="currentColor"/></svg>
                  <div class="st__link-row-info">
                    <span class="st__link-row-name">TikTok</span>
                    <span class="st__link-row-status">Connect</span>
                  </div>
                  <svg class="st__link-row-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4l6 6-6 6"/></svg>
                </div>
              </div>

              <div class="st__fields" style="margin-top: 1.5rem">
                <div class="st__field">
                  <label class="st__field-label">Spotify</label>
                  <input class="st__field-input" type="url" value={profileSpotify()} onInput={(e) => setProfileSpotify(e.currentTarget.value)} placeholder="Add profile URL" />
                </div>
                <div class="st__field">
                  <label class="st__field-label">YouTube</label>
                  <input class="st__field-input" type="url" value={profileYoutube()} onInput={(e) => setProfileYoutube(e.currentTarget.value)} placeholder="Add channel URL" />
                </div>
                <div class="st__field">
                  <label class="st__field-label">Website</label>
                  <input class="st__field-input" type="url" value={profileWebsite()} onInput={(e) => setProfileWebsite(e.currentTarget.value)} placeholder="Add URL" />
                </div>
              </div>

              <div class="st__divider" />

              <div class="st__actions">
                <button class="st__btn st__btn--primary" onClick={handleSaveProfile} disabled={profileSaving()}>
                  {profileSaving() ? "Saving..." : profileSaved() ? "Saved" : "Save Changes"}
                </button>
                <button class="st__btn st__btn--ghost" onClick={() => { setProfileName(user()?.name ?? ""); setProfileBio(""); setProfileInstagram(""); setProfileTwitter(""); setProfileWebsite(""); setProfileSpotify(""); setProfileYoutube(""); }}>
                  Reset
                </button>
              </div>
            </div>
          </Show>

          {/* ── Account ── */}
          <Show when={section() === "account"}>
            <div class="st__section">
              <h1 class="st__section-title">Account</h1>

              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Email</label>
                  <input class="st__field-input" type="email" value={accountEmail()} onInput={(e) => setAccountEmail(e.currentTarget.value)} placeholder="your@email.com" />
                </div>
                <div class="st__field-row">
                  <div class="st__field">
                    <label class="st__field-label">Date of Birth</label>
                    <input class="st__field-input" type="date" value={accountDob()} onInput={(e) => setAccountDob(e.currentTarget.value)} />
                  </div>
                  <div class="st__field">
                    <label class="st__field-label">Gender</label>
                    <select class="st__field-select" value={accountGender()} onChange={(e) => setAccountGender(e.currentTarget.value)}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="nonbinary">Non-binary</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="st__info-row">
                <div class="st__info-item">
                  <span class="st__info-label">Plan</span>
                  <span class="st__info-value">Free</span>
                </div>
              </div>

              <div class="st__actions">
                <button class="st__btn st__btn--primary" onClick={handleAccountSave} disabled={accountSaving()}>
                  {accountSaved() ? "Saved!" : accountSaving() ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">Change Password</h2>
              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Current Password</label>
                  <input class="st__field-input" type="password" value={currentPassword()} onInput={(e) => setCurrentPassword(e.currentTarget.value)} placeholder="••••••••" />
                </div>
                <div class="st__field">
                  <label class="st__field-label">New Password</label>
                  <input class="st__field-input" type="password" value={newPassword()} onInput={(e) => setNewPassword(e.currentTarget.value)} placeholder="Min 8 characters" />
                </div>
              </div>

              <Show when={passwordError()}>
                <span class="st__err">{passwordError()}</span>
              </Show>

              <div class="st__actions">
                <button class="st__btn st__btn--ghost" onClick={handleChangePassword}>
                  {passwordSaved() ? "Updated" : "Update Password"}
                </button>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title st__subsection-title--danger">Danger Zone</h2>
              <p class="st__danger-desc">Permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.</p>

              <Show when={deleteStep() === "none"}>
                <div class="st__actions">
                  <button class="st__btn st__btn--danger" onClick={() => setDeleteStep("confirm")}>Delete Account</button>
                </div>
              </Show>
              <Show when={deleteStep() === "confirm"}>
                <div class="st__confirm-bar">
                  <span class="st__confirm-text">Are you sure? This is irreversible.</span>
                  <button class="st__btn st__btn--danger" onClick={handleDeleteAccount}>Yes, delete</button>
                  <button class="st__btn st__btn--ghost" onClick={() => setDeleteStep("none")}>Cancel</button>
                </div>
              </Show>
            </div>
          </Show>

          {/* ── Notifications ── */}
          <Show when={section() === "notifications"}>
            <div class="st__section">
              <h1 class="st__section-title">Notifications</h1>
              <p class="st__section-desc">Choose what notifications you'd like to receive.</p>

              <h2 class="st__subsection-title">Activity</h2>
              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Likes</span><span class="st__toggle-desc">When someone likes your track</span></div>
                  <button class={`st__toggle${notifLikes() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_likes", notifLikes, setNotifLikes)}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Comments</span><span class="st__toggle-desc">When someone comments on your track</span></div>
                  <button class={`st__toggle${notifComments() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_comments", notifComments, setNotifComments)}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">New Followers</span><span class="st__toggle-desc">When someone follows you</span></div>
                  <button class={`st__toggle${notifFollows() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_follows", notifFollows, setNotifFollows)}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Mentions</span><span class="st__toggle-desc">When someone mentions you</span></div>
                  <button class={`st__toggle${notifMentions() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_mentions", notifMentions, setNotifMentions)}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Collaboration Requests</span><span class="st__toggle-desc">When someone invites you to collaborate</span></div>
                  <button class={`st__toggle${notifCollabs() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_collabs", notifCollabs, setNotifCollabs)}><span class="st__toggle-knob" /></button>
                </div>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">Delivery</h2>
              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Push Notifications</span><span class="st__toggle-desc">Show notifications in the app</span></div>
                  <button class={`st__toggle${notifPush() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_push", notifPush, setNotifPush)}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Email Notifications</span><span class="st__toggle-desc">Receive notifications via email</span></div>
                  <button class={`st__toggle${notifEmail() ? " st__toggle--on" : ""}`} onClick={() => toggleNotif("ms_notif_email", notifEmail, setNotifEmail)}><span class="st__toggle-knob" /></button>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Privacy ── */}
          <Show when={section() === "privacy"}>
            <div class="st__section">
              <h1 class="st__section-title">Privacy</h1>
              <p class="st__section-desc">Control who can see your content and interact with you.</p>

              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Private Account</span><span class="st__toggle-desc">Only approved followers can see your tracks and activity</span></div>
                  <button class={`st__toggle${privateAccount() ? " st__toggle--on" : ""}`} onClick={() => { const n = !privateAccount(); setPrivateAccount(n); saveBool("ms_priv_private", n); }}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Show Listening Activity</span><span class="st__toggle-desc">Let others see what you've been listening to</span></div>
                  <button class={`st__toggle${showActivity() ? " st__toggle--on" : ""}`} onClick={() => { const n = !showActivity(); setShowActivity(n); saveBool("ms_priv_activity", n); }}><span class="st__toggle-knob" /></button>
                </div>
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">Listening History</span><span class="st__toggle-desc">Display recently played tracks on your profile</span></div>
                  <button class={`st__toggle${showListeningHistory() ? " st__toggle--on" : ""}`} onClick={() => { const n = !showListeningHistory(); setShowListeningHistory(n); saveBool("ms_priv_history", n); }}><span class="st__toggle-knob" /></button>
                </div>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">Interactions</h2>
              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">Who can message you</label>
                  <select class="st__field-select" value={allowMessages()} onChange={(e) => { setAllowMessages(e.currentTarget.value); localStorage.setItem("ms_priv_messages", e.currentTarget.value); }}>
                    <option value="everyone">Everyone</option>
                    <option value="followers">People you follow</option>
                    <option value="none">Nobody</option>
                  </select>
                </div>
                <div class="st__field">
                  <label class="st__field-label">Who can comment on your tracks</label>
                  <select class="st__field-select" value={allowComments()} onChange={(e) => { setAllowComments(e.currentTarget.value); localStorage.setItem("ms_priv_comments", e.currentTarget.value); }}>
                    <option value="everyone">Everyone</option>
                    <option value="followers">Followers only</option>
                    <option value="none">Nobody</option>
                  </select>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Linked Accounts ── */}
          <Show when={section() === "linked"}>
            <div class="st__section">
              <h1 class="st__section-title">Linked Accounts</h1>
              <p class="st__section-desc">Connect your accounts to sign in faster and share your music across platforms.</p>

              <div class="st__linked-list">
                <div class="st__linked-item">
                  <div class="st__linked-icon st__linked-icon--google">
                    <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  </div>
                  <div class="st__linked-info"><span class="st__linked-name">Google</span><span class="st__linked-status">Not connected</span></div>
                  <button class="st__btn st__btn--ghost st__btn--sm">Connect</button>
                </div>
                <div class="st__linked-item">
                  <div class="st__linked-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                  </div>
                  <div class="st__linked-info"><span class="st__linked-name">GitHub</span><span class="st__linked-status">Not connected</span></div>
                  <button class="st__btn st__btn--ghost st__btn--sm">Connect</button>
                </div>
                <div class="st__linked-item">
                  <div class="st__linked-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                  </div>
                  <div class="st__linked-info"><span class="st__linked-name">Twitter / X</span><span class="st__linked-status">Not connected</span></div>
                  <button class="st__btn st__btn--ghost st__btn--sm">Connect</button>
                </div>
                <div class="st__linked-item">
                  <div class="st__linked-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                  </div>
                  <div class="st__linked-info"><span class="st__linked-name">Discord</span><span class="st__linked-status">Not connected</span></div>
                  <button class="st__btn st__btn--ghost st__btn--sm">Connect</button>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Security ── */}
          <Show when={section() === "security"}>
            <div class="st__section">
              <h1 class="st__section-title">Security</h1>

              <h2 class="st__subsection-title">Two-Factor Authentication</h2>
              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info">
                    <span class="st__toggle-name">2FA</span>
                    <span class="st__toggle-desc">Add an extra layer of security to your account</span>
                  </div>
                  <span class="st__badge">Coming Soon</span>
                </div>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">Active Sessions</h2>
              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info">
                    <span class="st__toggle-name">Current Session</span>
                    <span class="st__toggle-desc">This device — active now</span>
                  </div>
                  <span class="st__badge st__badge--active">Active</span>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Appearance ── */}
          <Show when={section() === "appearance"}>
            <div class="st__section">
              <h1 class="st__section-title">{t("appearance")}</h1>
              <p class="st__section-desc">{t("appearanceDesc")}</p>

              <h2 class="st__subsection-title">{t("theme")}</h2>
              <div class="st__theme-grid">
                <button class={`st__theme-card${theme() === "dark" ? " st__theme-card--active" : ""}`} onClick={() => { setTheme("dark"); localStorage.setItem("ms_theme", "dark"); applyTheme("dark"); }}>
                  <div class="st__theme-preview st__theme-preview--dark">
                    <div class="st__theme-bar" />
                    <div class="st__theme-body">
                      <div class="st__theme-sidebar" />
                      <div class="st__theme-content">
                        <div class="st__theme-line" />
                        <div class="st__theme-line st__theme-line--short" />
                      </div>
                    </div>
                  </div>
                  <span class="st__theme-label">{t("dark")}</span>
                </button>
                <button class={`st__theme-card${theme() === "light" ? " st__theme-card--active" : ""}`} onClick={() => { setTheme("light"); localStorage.setItem("ms_theme", "light"); applyTheme("light"); }}>
                  <div class="st__theme-preview st__theme-preview--light">
                    <div class="st__theme-bar" />
                    <div class="st__theme-body">
                      <div class="st__theme-sidebar" />
                      <div class="st__theme-content">
                        <div class="st__theme-line" />
                        <div class="st__theme-line st__theme-line--short" />
                      </div>
                    </div>
                  </div>
                  <span class="st__theme-label">{t("light")}</span>
                </button>
                <button class={`st__theme-card${theme() === "system" ? " st__theme-card--active" : ""}`} onClick={() => { setTheme("system"); localStorage.setItem("ms_theme", "system"); applyTheme("system"); }}>
                  <div class="st__theme-preview st__theme-preview--system">
                    <div class="st__theme-bar" />
                    <div class="st__theme-body">
                      <div class="st__theme-sidebar" />
                      <div class="st__theme-content">
                        <div class="st__theme-line" />
                        <div class="st__theme-line st__theme-line--short" />
                      </div>
                    </div>
                  </div>
                  <span class="st__theme-label">{t("system")}</span>
                </button>
              </div>

              <div class="st__divider" />

              <h2 class="st__subsection-title">{t("layout")}</h2>
              <div class="st__toggle-list">
                <div class="st__toggle-row">
                  <div class="st__toggle-info"><span class="st__toggle-name">{t("compactMode")}</span><span class="st__toggle-desc">{t("compactDesc")}</span></div>
                  <button class={`st__toggle${compactMode() ? " st__toggle--on" : ""}`} onClick={() => { const n = !compactMode(); setCompactMode(n); saveBool("ms_compact", n); }}><span class="st__toggle-knob" /></button>
                </div>
              </div>
            </div>
          </Show>

          {/* ── Language ── */}
          <Show when={section() === "language"}>
            <div class="st__section">
              <h1 class="st__section-title">{t("language")}</h1>
              <p class="st__section-desc">{t("languageDesc")}</p>

              <div class="st__fields">
                <div class="st__field">
                  <label class="st__field-label">{t("displayLanguage")}</label>
                  <select class="st__field-select" value={language()} onChange={(e) => saveLanguage(e.currentTarget.value)}>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="pt">Português</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="zh">中文</option>
                    <option value="ru">Русский</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>
              </div>
              <Show when={langSaved()}>
                <span class="st__saved-msg">{t("languageSaved")}</span>
              </Show>
            </div>
          </Show>

        </main>
      </div>
    </div>
  );
};

export default Settings;
