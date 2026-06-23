# MeloStudio Architecture

## Ecosystem map

Every user action follows this path:

```
Browser → src/routes/<page>.tsx     (thin route — auth guard + lazy import)
       → src/pages/<Page>.tsx       (all component logic lives here)
       → src/lib/api.ts             (typed fetch helpers — the only place URL shapes live)
       → src/routes/api/<route>.ts  (server handler — auth via projectAccess.ts)
       → src/lib/db/ or Netlify Blobs
```

---

## Adding a new page

1. Create `src/pages/mypage/MyPage.tsx` — fat component with all logic
2. Create `src/routes/mypage.tsx` — thin wrapper:

```tsx
import { lazy, Suspense } from "solid-js";
import RouteVeil from "~/components/RouteVeil";
import { ProtectedPage } from "~/lib/session";

const MyPage = lazy(() => import("~/pages/mypage/MyPage"));

export default function MyPageRoute() {
  return (
    <ProtectedPage label="my page">
      <Suspense fallback={<RouteVeil label="Loading..." />}>
        <MyPage />
      </Suspense>
    </ProtectedPage>
  );
}
```

3. For public pages (no auth required), omit `<ProtectedPage>` — see `src/routes/share/[id].tsx`.

---

## Adding a new API endpoint

1. Create `src/routes/api/myendpoint.ts`
2. Use the shared guards from `src/lib/server/projectAccess.ts`:
   - `getReadAccess(request, projectId)` — published projects bypass auth; unpublished require owner
   - `getOwnerAccess(request, projectId)` — always authenticates, returns 401/403/404 shapes
3. Add a typed helper in `src/lib/api.ts` so callers never hand-build URL strings

```ts
// src/lib/api.ts
export async function myThingApi(id: string): Promise<MyThing | null> {
  const res = await apiFetch(`/api/mything/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}
```

---

## Adding a project field

Four places to touch:

| # | File | What to do |
|---|------|-----------|
| 1 | `src/lib/audio/types.ts` | Add field to `ProjectDoc` interface |
| 2 | `src/pages/studio/hooks/useProject.ts` | Include field in `normalizedProjectJson` and `applyDoc` |
| 3 | `src/routes/api/projects/[id].ts` | Add to `isProjectDocPayload` validator **only if required on every save** |
| 4 | `src/routes/api/projects/[id].ts` PATCH handler | Add if the field should be settable via PATCH |

---

## Clip 3-tier storage

```
Record/import → IndexedDB ("melostudio-clips")      always available locally
              → inline dataUrl (≤2.8 MB)            embedded in save payload
              → /api/clips/:id?projectId=:pid        large clips, Netlify Blobs / local .data/
```

**Rule:** Build clip URLs only via `clipUrl(projectId, clipId)` from `src/lib/api.ts`.  
Never hand-write `/api/clips/...` strings — that's how bugs like the Profile waveform issue happened.

Upload logic lives in `src/lib/remoteClips.ts`. `remoteClipUrl` is a re-export of `clipUrl` for zero importer churn.

---

## Auth / session

- **Client:** `src/lib/session.tsx` — `ProtectedPage` component + `getSession()` (no caching — avoids stale-session trap)
- **Server:** `src/lib/auth-server.ts` — `requireUserId(request)` returns userId or null
- **Providers:** Better Auth (cookie) + Neon Auth (JWT Bearer). Both are probed; `apiFetch` in `src/lib/api.ts` attaches the JWT when Neon is active. **Always use `apiFetch`, never raw `fetch`, for authenticated API calls.**

---

## Schema truth

| Thing | Where it lives | Notes |
|-------|---------------|-------|
| `ProjectDoc.tracks` / `.assets` / `.master` | DB JSONB | Required by `isProjectDocPayload` in `[id].ts:28`. Never remove from save payload even if empty. |
| `uiTracks` | DB JSONB | The real persisted track data (`UITrack[]`). Preferred over `tracks` at read time. |
| `_published` | Server-only | Smuggled into GET response by the server. Extracted and stripped by `getProjectDocApi` in `api.ts`. **Never appears in PUT payload.** |
| Clip `id` | `Clip.id` in ProjectDoc | Used to build the remote URL. The clip blob lives at `clipUrl(projectId, clip.id)`. |

---

## URL builders — single source of truth

All in `src/lib/api.ts`. Never duplicate these:

```ts
clipUrl(projectId, clipId)   // /api/clips/:id?projectId=:pid
pfpUrl(userId)               // /api/user/:id/pfp
shareUrl(projectId)          // https://melostudio.co/share/:id
isApiClipUrl(url)            // true if url points to our clip API
```

---

## Known deferred debt

- **Dashboard prop drilling** — Dashboard.tsx passes ~50 props down; extracting sub-components would help but it works fine now
- **Share route** — `src/routes/share/[id].tsx` is still ~1150 LOC inline; logic could move to `src/pages/share/Share.tsx` for consistency
- **Stripped-clip auto-upload** — when a clip is too large to embed and remote upload also fails, it silently plays only on the recording device; could show a retry button
- **Privacy/data-deletion routes** — still inline in `src/routes/`, not in `src/pages/`
