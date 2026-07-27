# Test Report — PR #1 Web Push Notifications (AcidTrack)

**Branch:** `devin/1785131800-web-push-notifications` · repo `israel-mulenga/acidtrack`
**How tested:** Ran the app locally. Build/lint reconfirmed; app booted against a **dummy** Supabase config (no live project available). Because the account menu only renders when authenticated, I used a **temporary, disclosed session stub** in `src/session.tsx` to render the authenticated shell, then exercised the push-subscribe flow on the **production `npm run preview` build** (the real deployment target). The stub was fully reverted afterward (repo verified clean vs HEAD).

## Environment constraint (important)
- No Supabase credentials exist (`list_secrets` empty, no env/.env files). `src/lib/supabase.ts` throws at startup without `VITE_SUPABASE_URL`/`ANON_KEY`, so a dummy `.env.local` was added (gitignored) to boot.
- Consequently, anything requiring a live backend was **not** exercised: the `push_subscriptions` DB upsert, `desactiverNotifications` delete, the SQL trigger → Edge Function `envoyer-push` → device delivery, and the `useNotificationsRealtime` in-app toast.

## Results

| # | Assertion | Result |
|---|-----------|--------|
| 1 | `npm install` present; `npm run build` succeeds (injectManifest → `dist/sw.js`) | ✅ Passed |
| 1 | `npm run lint` succeeds (exit 0) | ✅ Passed |
| 2 | App boots to Connexion login page, no crash / no Supabase throw | ✅ Passed |
| 2 | Custom service worker `sw.js` registers & activates in browser | ✅ Passed |
| 2 | Built SW contains `push` + `notificationclick` handlers, `showNotification`, and runtime caches (`donnees-supabase`, `documents`) | ✅ Passed |
| 2 | `registerType: 'prompt'` intact — update offered via banner, not auto-applied; install banner shows | ✅ Passed |
| 2 | Account menu shows "Activer les notifications" entry with subtitle | ✅ Passed |
| 3 | Clicking toggle fires the real Chrome Notification permission prompt | ✅ Passed |
| 3 | On grant, `PushManager.subscribe` creates a real FCM endpoint + p256dh/auth keys | ✅ Passed |
| — | `push_subscriptions` DB upsert / full push delivery | ⚠️ Untestable (no live Supabase) |

## Evidence

### App boots to login page (no crash, Supabase guard OK)
![App boots to Connexion login page](https://app.devin.ai/attachments/41b6ce17-0756-4fa0-810a-afef2394baba/ss_7dbc4e08.png)

### Custom service worker activated (production build)
DevTools → Application → Service Workers: **Source `sw.js`**, **Status "#1 activated and is running"** (Install → Wait → Activate completed).
![SW activated and running](https://app.devin.ai/attachments/f9bc9630-9d8d-4f49-9f7b-fc9fa473ec32/ss_92f4e188.png)

Built-SW verification (shell):
```
addEventListener(`push`)              x1
addEventListener(`notificationclick`) x1
showNotification                      present
donnees-supabase / documents          both present
```
Runtime confirmation (console): `PREVIEW_SW {"state":"active:activated","url":".../sw.js","handlers":{"notificationclick":true,"precache":true}}`

### Account menu toggle renders
![Activer les notifications menu entry](https://app.devin.ai/attachments/426693bf-00a1-4109-ad64-ec8734029b2e/ss_76b7b487.png)

### Real Chrome permission prompt on click
![Chrome Show notifications permission prompt](https://app.devin.ai/attachments/a5d43855-2887-4bcb-8847-92a0d852f869/ss_f0915c06.png)

### registerType 'prompt' intact — update offered, not forced
![Nouvelle version disponible update banner](https://app.devin.ai/attachments/dfaf23e5-4e67-42c0-a458-e68c149e78aa/ss_d90c11ca.png)

### Subscribe succeeds; only the DB upsert fails (expected, dummy backend)
After granting permission with a valid VAPID key, the browser created a genuine push subscription:
```
SUBSCRIPTION {"endpoint":"https://jmt17.google.com/fcm/send/dgxNYu_lIi8:APA91bG6lQLhNz...","hasKeys":true}
```
The toast "Activation des notifications impossible." is thrown only because the subsequent `push_subscriptions` upsert hits the dummy Supabase — the expected boundary of local testing.
![Generic toast after subscribe, from DB upsert failure](https://app.devin.ai/attachments/de5ba305-d650-4bb4-b77d-16d51f6f4f25/ss_614e57d4.png)

## Notes / observations
- **Dev-mode SW quirk (not a defect):** under `npm run dev`, the `injectManifest` module SW stayed stuck at "#0 trying to install" and never activated. The production `preview` build's `sw.js` activates immediately. This is a common vite-plugin-pwa dev limitation; the deployment target (Vercel prod build) is unaffected.
- All FE assertions were validated on the production build, which is the shipped artifact.
