# Workflow security and execution flow

**Single deploy workflow:** `main.yml` (Deploy to GitHub Pages). Do not add a second workflow that also deploys to Pages on push to main/master, or both would run and can conflict.

## 1. When is this workflow triggered?

| Trigger              | Source                    | Uses secrets? | Runs automatically? |
|----------------------|---------------------------|---------------|----------------------|
| **push** to `main`   | Same repo only            | Yes           | Yes                  |
| **workflow_dispatch**| Same repo (manual run)    | Yes           | Yes (when you click)|
| **pull_request**     | Same repo or fork         | No (deploy skipped) | See below      |

## 2. Secrets used by the workflow

- `SUPABASE_URL` – Supabase project URL (repo secret)
- `SUPABASE_ANON_KEY` – Supabase anonymous key (repo secret)
- `PAYMENT_URL` – Payment link (repo secret)
- `GITHUB_TOKEN` – used by `deploy-pages` (automatic; not visible to fork code)

Fork pull requests **never** run the deploy job that uses these secrets. Only pushes to `main` and manual runs from the main repo do.

## 3. Safe execution strategy

- **Branches in the main repository**
  - **Push to `main`** → Deploy runs automatically (uses secrets, deploys to GitHub Pages).
  - **Manual run** (Actions → “Deploy to GitHub Pages” → Run workflow) → Same as above.
- **Pull requests (including from forks)**
  - **Optional:** A separate “PR check” job can run (e.g. validate files, no secrets).
  - **Deploy is never run** for any pull request; it only runs on `push: main` and `workflow_dispatch`.

So: **approvals are not required for normal operation**. Fork PRs either don’t run the workflow at all or only run a job that doesn’t use secrets. That avoids stuck “queued” runs while keeping secrets safe.

## 4. Flow diagram (when approvals are needed vs automatic)

```
                    ┌─────────────────────────────────────┐
                    │  Event that starts the workflow     │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     push to main              workflow_dispatch        pull_request
     (main repo only)          (main repo only)        (main or fork)
              │                       │                       │
              │                       │                       │
              ▼                       ▼                       ▼
     Run deploy job            Run deploy job         Run only "pr-check"
     (uses secrets)            (uses secrets)         (no secrets)
     Deploy to Pages           Deploy to Pages        No deploy
              │                       │                       │
              ▼                       ▼                       ▼
         ✅ Automatic             ✅ On demand            ✅ Automatic
         No approval              No approval            No approval
         needed                   needed                 needed
```

**Summary**

- **Automatic:** Push to `main`, and (if you add it) PR checks that don’t use secrets.
- **On demand:** “Deploy to GitHub Pages” from the Actions tab.
- **No approval needed** for these, because fork PRs never run the secret-using deploy job.

## 5. Repository settings (recommended)

In **Settings → Actions → General**:

1. **Fork pull request workflows**
   - Set to **“Require approval for first-time contributors”** if you want an extra gate for first-time contributors’ PRs (optional).
   - Or **“Run workflows from fork pull requests”** with **“Allow”** and rely on the workflow logic (no deploy for PRs) so nothing gets stuck waiting for approval.

2. **Workflow permissions**
   - Keep **“Read and write permissions”** for the Pages deployment (needed for `deploy-pages`).

3. **Secrets**
   - Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PAYMENT_URL` are set under **Settings → Secrets and variables → Actions**. Fork workflows cannot read these when the deploy job is not run for PRs.

With the updated workflow YAML (see section 6 below), **approvals are only needed if you explicitly enable “Require approval for first-time contributors”**. Otherwise, workflows run automatically without getting stuck, and secrets stay protected because deploy runs only on `main` and `workflow_dispatch`.

---

## 6. Actionable steps (checklist)

- [ ] **Workflow YAML** – Use the updated `main.yml`: deploy has `if: github.event_name != 'pull_request'`; `pr-check` runs on PRs and uses no secrets.
- [ ] **Secrets** – In the repo: **Settings → Secrets and variables → Actions**. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PAYMENT_URL` if missing.
- [ ] **Fork PRs** – In **Settings → Actions → General**: under "Fork pull request workflows", choose either **Allow** (no approval) or **Require approval for first-time contributors**.
- [ ] **Avoid pull_request_target** – Do not use `pull_request_target` for this workflow; it would expose repo secrets to fork code.
- [ ] **Optional** – To disable any job on PRs, remove the `pull_request` trigger and the `pr-check` job from `main.yml`.
