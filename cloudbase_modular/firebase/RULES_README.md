# ATLAS Firebase Realtime Database Security Rules

## Deploying Rules

From the `firebase/` directory:

```bash
firebase deploy --only database
```

Requires Firebase CLI (`npm install -g firebase-tools`) and `firebase login`.

**Always test rules in the Firebase Console Rules Playground before deploying to production.**
Go to: Firebase Console > Realtime Database > Rules > Rules Playground

---

## What Each Section Protects

| Path | Read | Write |
|---|---|---|
| `/public_stats` | Public (no auth) | Authenticated non-anonymous users |
| `/peacs_public_stats` | Public (no auth) | Authenticated non-anonymous users |
| `/assessments/$workspace_key` | Matching workspace, parent institution, or superadmin | Matching workspace or superadmin |
| `/peacs_assessments/$workspace_key` | Same as `/assessments` | Same as `/assessments` |
| `/peacs_dimensions` | Superadmin, institution, or PI roles | Any workspace-authenticated user |
| `/workspace_profiles/$workspace_key` | Own workspace or superadmin | Own workspace or superadmin |
| `/workspaces` | Superadmin only (root); own key (scoped) | Superadmin only |
| `/audit_log` | Superadmin only | Any non-anonymous authenticated user |
| `/ws_audit/$workspace_key` | Own workspace, PI, institution, or superadmin | Any non-anonymous authenticated user |
| `/site_banner` | Public (no auth) | Superadmin only |
| `/campaigns` | Any authenticated user | Superadmin only |
| `/mapData` | Any authenticated user | Any authenticated user |
| `/peacs_mapData` | Any authenticated user | Any authenticated user |
| `/globalStats` | Public (no auth) | Any authenticated user |
| `/config` | Superadmin only | Superadmin only |
| `/export_counts/$workspace_key` | Own workspace or superadmin | Own workspace or superadmin |
| `/checkins/$workspace_key/$uid` | Own UID, own workspace, or superadmin | Own UID or own workspace |
| `/wad_checkins` | Any authenticated user | Any authenticated user |
| `/wall_projects` | Any authenticated user | Superadmin only |
| `/partner_sites` | Any authenticated user | Superadmin only |
| `/errors` | Superadmin only | Any authenticated user |
| `/warnings` | Superadmin only | Any authenticated user |
| `/bulk_uploads` | Superadmin only | Any workspace-authenticated user |
| All other paths | Denied | Denied |

---

## Token Claims

Rules rely on Firebase custom token claims set by the ATLAS Lambda (`/validate-key`):

- `auth.token.role` — one of: `superadmin`, `institution`, `pi`, `researcher`, `independent`, `clinician`, `student`, `observer`
- `auth.token.workspace_key` — the workspace key for this session
- `auth.token.parent_institution` — set on child PI workspaces to enable institution-level reads

---

## References

- [Firebase Security Rules documentation](https://firebase.google.com/docs/database/security)
- [Rules Playground](https://firebase.google.com/docs/database/security/rules-playground)
- [Custom token claims](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
