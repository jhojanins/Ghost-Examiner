# Deploy Ghost Examiner to Netlify

## Resumen en español

1. **Antes:** el CI de `main` debe estar en verde en GitHub (pestaña **Actions**).
2. **GitHub Desktop:** cambia a la rama `release`, menú **Branch → Update from main**, luego **Push origin**. Vuelve a `main`.
3. **Netlify:** **Add new project → Import an existing project → GitHub**, elige `Ghost-Examiner` y la rama **`release`**. Deja vacío el directorio base. Pulsa **Publish** (o **Deploy**).
4. **Hazlo público:** **Project configuration → General → Visitor access → Project visibility**: pon **Public** en producción y en previews. Si no, nadie más puede ver la página.
5. **Activa `main`:** **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure**, elige **Let me add individual branches**, escribe `main` y pulsa **Save**.
6. **Costo:** cada deploy exitoso de `release` cuesta **15 créditos** (máximo 10 al mes). Los deploys de `main` y los que fallan **no cuestan nada**.
7. **Si falla:** no lo repitas. Copia el log y pégalo en el chat de Kiro. No pulses **Fix with agent** (gasta créditos).

---

This guide is for the owner. Short steps. Words in **bold** are the exact names of buttons and menus.

## What costs credits

| Action | Credits |
|---|---|
| A successful deploy of `release` (production) | **15** |
| A deploy of `main` (branch deploy) | 0 |
| A deploy preview of a pull request | 0 |
| A failed deploy | 0 |
| Visitors (about 80 KB per visit) | almost 0 |

- The Free plan has **300 credits per month**. It is a hard limit.
- If credits reach 0, **every project is paused** until next month. Visitors see "Site not available".
- Our rule: **at most 10 production deploys per month** (150 credits).

Source: Netlify, [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/).

## Before you start

- [ ] The latest commit on `main` is pushed.
- [ ] The CI run for that commit is **green**. Check on GitHub: repository → **Actions** tab → the top run has a green check.
- [ ] You have a Netlify account (Free plan) and you are logged in at [app.netlify.com](https://app.netlify.com).

Why the CI check matters: the CI installs pnpm the same way Netlify does (Node 24 and Corepack). If CI is green, the Netlify build should work too.

## Step 1. Bring `release` up to `main` (GitHub Desktop)

`release` is the branch Netlify publishes. Right now it is very old (only the first commit). Bring it up to `main` **before** you connect Netlify. This push is free, because Netlify is not connected yet.

1. Open **GitHub Desktop**. At the top, **Current repository** must say `Ghost-Examiner`.
2. Click **Current branch** (top bar). Choose **`release`**.
3. Open the **Branch** menu (in the menu bar). Click **Update from main**.
4. Click the **History** tab. The top commit must be the newest task commit (the same one you see on `main`).
5. Click **Push origin** (top bar).
6. Click **Current branch** again and choose **`main`**. Always go back to `main`. New work happens on `main`.

**Important for later:** after Netlify is connected, every **Push origin** on `release` is a production deploy (15 credits). Do it only when you want to publish.

## Step 2. Import the project into Netlify

1. Go to [app.netlify.com](https://app.netlify.com).
2. Click **Add new project**. Then click **Import an existing project**.
3. Click **GitHub**. If GitHub asks for permission, allow access to the `jhojanins/Ghost-Examiner` repository.
4. Choose the repository **`Ghost-Examiner`**.
5. On the settings page, check each field:

   | Field | Value |
   |---|---|
   | **Branch to deploy** | **`release`** (not `main`) |
   | **Base directory** | empty |
   | **Build command** | `pnpm build` (Netlify reads it from `netlify.toml`) |
   | **Publish directory** | `dist` |

   Netlify may say it found several apps in this repository (a "monorepo") and ask which one to build. **Do not choose `ghost-interview` or `ghost-defense`.** Choose the repository root, so the base directory stays empty. The build makes all three pages together.
6. Click **Publish** (in some versions the button says **Deploy**).

This first build is a production deploy: **15 credits if it succeeds, 0 if it fails.**

## Step 3. Check the build

1. In your new project, click **Deploys**. Click the top deploy to open its log.
2. Wait 1 to 3 minutes. A good log contains these lines (the exact words can change a little):
   - `Now using node v24`
   - `pnpm workspaces detected`
   - `Site assembled in dist/: /, /interview/, /defense/`
   - `Deploy is live` or `Site is live`
3. At the top of the project page you see the project URL, like `https://<name>.netlify.app`. Write it down.

If the log says **Failed**, go to [If the build fails](#if-the-build-fails).

## Step 4. Make the project public

New Netlify projects are **private**: only you can see them. Judges must be able to open the URL.

1. Go to **Project configuration → General → Visitor access → Project visibility**.
2. Set **Production** to **Public**.
3. Set **Previews** to **Public** too. The Day 5 checkpoint uses the `main` branch-deploy URL, and branch deploys count as previews.
4. Click **Save**.

You can also click **Make public** in the toolbar Netlify shows on a private project. It works after the first successful production deploy.

Check: open the project URL in a **private window** of your browser. You must see the landing page, not a Netlify login page.

Source: Netlify, [Project visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/).

## Step 5. Turn on branch deploys for `main`

By default, Netlify only builds `release`. We also want a free test URL for `main`.

1. Go to **Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts**.
2. Click **Configure**.
3. **Production branch:** it must say `release`. If not, type `release`.
4. **Branch deploys:** choose **Let me add individual branches**. Type `main`.
5. **Deploy Previews:** leave as it is.
6. Click **Save**.

Source: Netlify, [Branch deploys](https://docs.netlify.com/deploy/deploy-types/branch-deploys/).

## Step 6. Get the `main` test URL

Netlify builds `main` on the **next push** to `main`.

1. Push any new commit on `main` with **GitHub Desktop** (**Push origin**). Or tell Kiro, and Kiro makes a small commit for you to push.
2. In Netlify, click **Deploys**. A new deploy for `main` appears. It costs 0 credits.
3. The test URL is `https://main--<name>.netlify.app`. Open it in a private window.
4. Tell Kiro both URLs. Kiro records them in `docs/KIRO_USAGE.md` and the README (task 34).

**Do not** use **Trigger deploy** on the **Deploys** page to get this URL. That button builds the production branch (`release`) and costs 15 credits.

## Everyday routine

| You want to | Do this | Credits |
|---|---|---|
| Try new work online | Push `main`. Open `main--<name>.netlify.app`. | 0 |
| Publish to the real URL | Step 1 again (switch to `release`, **Update from main**, **Push origin**, back to `main`). | 15 |
| Check how many credits are left | Netlify: your team → **Usage** (or **Billing**). | 0 |

Publish only after the `main` URL works and CI is green.

## If the build fails

A failed deploy costs **0 credits**. If an older version was live, it **stays live**.

1. **Do not run the same build again.** It will fail the same way. Fix the cause first.
2. Open **Deploys**, then the failed deploy. Click the clipboard icon (**Copy to clipboard**) at the top of the log.
3. Paste the log in the Kiro chat and write: "The Netlify build failed."
4. You may click **Why did it fail?** It is free. **Do not click Fix with agent.** It uses credits.
5. Kiro fixes the problem on `main`. Wait for the CI run on `main` to be green.
6. Do Step 1 again. The new production deploy starts by itself after **Push origin**.

Common causes:

| The log says | Meaning | Fix |
|---|---|---|
| `Cannot find module ... pnpm.cjs` or a `corepack` error | The pnpm install failed (Node version or Corepack) | Check that `netlify.toml` still says `NODE_VERSION = "24"`. Send the log to Kiro. |
| `ERR_PNPM_OUTDATED_LOCKFILE` or `frozen-lockfile` | `pnpm-lock.yaml` does not match `package.json` | Kiro runs `pnpm install` on your Mac and commits the lockfile. |
| `Missing script: build` or no `package.json` | Netlify built an old `release` | Do Step 1 again. |
| `Base directory does not exist` or only one app is built | A wrong folder was chosen in Step 2 | **Project configuration → Build & deploy → Build settings**: make **Base directory** empty. |

## When credits run low

- Below 60 credits left (4 deploys): stop publishing until next month. Keep using the free `main` URL.
- The live URL must work until **Jan 29, 2027**. A paused project breaks it, so never use the last credits.
