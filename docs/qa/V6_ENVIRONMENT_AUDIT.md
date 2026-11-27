# V6 environment and safety audit

Checked 2026-11-27 in `/home/priom/Desktop/mahi`.

| Item | Verified result |
| --- | --- |
| Git | `main` tracking `origin/main`; initially clean; HEAD `b93ed7b` |
| Origin | `nahid-priom/glamours-by-mahi` |
| Frontend Supabase reference | `vahqinuminrcjpussimn` from `.env.local` URL; keys and credentials withheld |
| Supabase CLI link | `.temp/project-ref` contains `vahqinuminrcjpussimn` |
| Supabase config | Placeholder `project_id`, so the `.temp` link is the operational identity |
| Migrations | Initially 156 versioned SQL files; latest live applied version `20260315000161`; V6 prepared `20260315000162`–`20260315000164` locally only |
| Edge Functions | `admin-create-user` and 11 other function directories exist in source; live `admin-create-user` OPTIONS preflight returned HTTP 404, `NOT_FOUND` from Supabase gateway |
| Vercel | SPA fallback rewrite present in `vercel.json` |
| Package manager | npm lockfile and installed `node_modules` present; shell lacks `node`/`npm` on PATH, but Cursor provides a Node 24 binary |
| E2E safety | `.env.e2e.local` labels the target `staging-isolated` and enables mutating E2E, but its pooler username contains the **same** project reference as `.env.local`: `vahqinuminrcjpussimn` |

The matching frontend and CLI references identify a production-sensitive target. The E2E label is **not** evidence of staging isolation; mutating E2E must remain disabled until a distinct project is configured and verified. A read-only PostgreSQL transaction connected as `postgres`; it verified 306 live policies, the latest applied migration, relevant RLS/grants, and deployed function text. The `admin-create-user` preflight was tested without credentials or mutation; its gateway 404 confirms the endpoint is unavailable in this project. No Edge Function version/logs, backup, distinct staging project, or production mutation authorization was verified. No database mutation, migration push, Edge Function deployment, production test transaction, or credential exposure was performed. Deployment remains restricted until target, backup, staging, and authorization are verified.
