# Project vaults plan (slice 5.15)

Status: working plan for roadmap slice 5.15, split into 5.15a–5.15c on
2026-10-25. The roadmap's 5.15 entry (Phase 5) is the requirement and its
status board is authoritative for progress; this file records the design and
the split. Archive it when 5.15c closes.

## Design

**Where encryption happens.** Every IndexedDB read and write in the main
database already goes through `openDb()` (slice 3.23a), and uses only `get`,
`getAll`, `put`, `delete`, and `index('projectId').getAll`. The vault wraps
the database that `openDb()` returns, so every repository encrypts and
decrypts at one seam without changing. The separate rulesets database gets
the same wrapper.

**Why synchronous AES-GCM.** IndexedDB commits a transaction as soon as its
code awaits anything else, and WebCrypto is async. `runProjectWriteTransaction`
reads and writes inside one transaction, so the per-record cipher must be
synchronous. Records use AES-256-GCM from `@noble/ciphers` (audited, no
dependencies). The passphrase step stays in WebCrypto: PBKDF2-SHA256 at
600,000 iterations runs once at unlock, outside any transaction.

**Keys.** Each protected project has a random 256-bit data key. The
passphrase (NFC-normalized) derives a key-encryption key that wraps the data
key with AES-256-GCM. The authenticated header binds the wrap to the project
id and the KDF settings. Changing the passphrase re-wraps the data key and
leaves the records alone. The data key exists only in memory while the
project is unlocked.

**Stored shapes.**

- A project record becomes `{id, vaultManifest, sealed}`. The manifest holds
  only the format version, KDF name/hash/iterations/salt, the wrapped key, and
  the display label (default **Locked project**). The name, description, and
  every other field are inside `sealed`.
- Every other project-owned record becomes `{id, projectId, sealed}`. `id` and
  `projectId` stay readable so the `projectId` index, unique indexes, deletion,
  and import collision checks keep working.
- `sealed` is `{v, iv, ct}`. The authenticated data names the store, project,
  and record id, so a record cannot be moved to another record, store, or
  project.

**Locked behavior.** A locked project's records are returned still sealed:
only `id` and `projectId` are readable, and nothing else can be shown.
Writing to a locked project throws `VaultLockedError` and aborts the
transaction. Deleting by key still works, so a locked project can be deleted.
A sealed record that is written back unchanged is stored unchanged.

**Registry.** A synchronous in-memory registry of protected projects is
loaded from the project manifests before the first wrapped database is
handed out. Enabling, disabling, locking, and unlocking update it, and a
`BroadcastChannel` tells other tabs of the browser build. The desktop app has
one window. A tab that misses the message could write plaintext into a
protected project. That gap is recorded below, not hidden.

**Migrations.** Enable reads every record of the project, encrypts it in
memory, decrypts each one again and compares it with the original, and then
replaces the records in one `readwrite` transaction across the project
stores. The swap either commits fully or not at all. The rulesets database is
separate, so it is written second; if that fails, the main swap is reversed
(compensating recovery, as project deletion does). No plaintext migration
backup is made. Disable requires the passphrase and runs the same steps in
reverse.

**Threat boundary.** This protects app-owned data at rest. It does not cover:

- plaintext visible while the project is unlocked;
- operating-system swap or screen capture;
- malware;
- files the author exported unencrypted.

IndexedDB writes to an append-only store on disk. Plaintext overwritten by
the enable migration can remain in old pages until the browser compacts them,
and the app cannot force that. 5.15c measures this on disk and the copy
states it honestly. There is no recovery: a lost passphrase means a lost
project.

## Slices

### 5.15a — Vault core (M)

- `services/storage/vault/`:
  - key hierarchy and manifest;
  - record seal/open;
  - registry;
  - database wrapper;
  - a `projectVault` service with enable, unlock, lock, change passphrase,
    and disable.
- `openDb()` and the rulesets database return the wrapped database.
- Not reachable from the UI. No `DB_VERSION` or snapshot schema change.
- Real-IndexedDB tests (fake-indexeddb) prove:
  - round trip and wrong passphrase;
  - tamper and swap refusal;
  - locked reads stay sealed and locked writes are refused;
  - cross-project key isolation;
  - change passphrase without rewriting records;
  - enable/disable rollback when a write fails partway;
  - deletion of a locked project;
  - a planted phrase absent from every store after enable;
  - the backup export of an unlocked vault matches the plain project.

### 5.15b — Vault UX and derived data (L)

- Projects:
  - **Protect with a passphrase**, with the no-recovery acknowledgment;
  - unlock dialog;
  - **Lock project**;
  - change and remove passphrase.
- Lock on app restart and when another project opens.
- Locked projects render only their label, with no previews, search results,
  recent excerpts, or notifications.
- Retrieval and memory databases are in-memory only for protected projects:
  delete them when protection is enabled, rebuild them after unlock.
- Content keys in `localStorage`/`sessionStorage` (architecture-review
  inventory) are kept in memory or cleared on lock for protected projects.
- Backup export of a protected project defaults to an encrypted `.sagabackup`.

### 5.15c — Verification and copy (M)

- Planted-phrase scan across every app-owned store and browser-storage key.
- On-disk scan of the packaged desktop profile.
- Cypress vault journeys.
- Electron packaged smoke on macOS and Windows.
- A `docs/smoke-tests.md` procedure.
- Privacy and help copy, written only after these checks pass.

## Known gaps to close or state

- A browser tab that misses the registry broadcast (5.15b decides whether to
  block a second tab while a vault is unlocked).
- Plaintext left in old IndexedDB pages after enable (5.15c measures it).
- Record ids are readable. 5.15a checked how stored ids are built. Most are
  random or built from other ids. One exception: zone-affinity profiles and
  progress use `zone-profile:<project>:<biomeKey>` and
  `zone-progress:<project>:<biomeKey>:…`. `biomeKey` is a slug of the zone
  name or source entity name, so those names stay readable on a protected
  project. **5.15b** moves those records to opaque ids, looking them up
  through the `projectId` index, with a project schema migration. 5.15c's
  planted-phrase scan includes a zone record.
