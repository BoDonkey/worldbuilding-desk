# Releasing SagaSpine

How a desktop release reaches authors (Slice 5.1). Builds are unsigned
through the beta by author decision (Slice 5.2); signing, macOS first, lands
before the paid launch. Until then, every release page includes the first
launch steps below.

## Steps

1. Set the release version in `apps/desktop/package.json` (`"version"`), merge
   it to `main`, and confirm Web CI is green, including the Desktop E2E and
   Desktop update jobs.
2. Tag that commit `v<version>` (for example `v0.2.0`) and push the tag. The
   **Release** workflow refuses a tag that does not match the version.
3. The workflow builds macOS (Intel and Apple silicon), Windows, and Linux,
   and uploads the installers plus `latest.yml`, `latest-mac.yml`, and
   `latest-linux.yml` to a **draft** GitHub release.
4. Review the draft: release notes, every platform's files, and an install
   of at least one build. Installed apps do not see drafts.
5. Publish the release. Installed apps that allowed automatic checks find it
   at their next start; everyone else finds it through **Settings → Updates →
   Check for updates**.

Do not edit or replace files on a published release: installed apps verify
each download against the sha512 in its `latest*.yml`. Ship a new version
instead.

## What installed apps do

- They ask once whether to check automatically, and never contact GitHub
  before that answer. A check reads the release manifest only; it sends no
  project data.
- Downloads and installs wait for the author. A downloaded update installs
  on **Restart to update** or the next time the app quits.
- Windows and Linux (AppImage) install in place. macOS opens the release
  page until signed builds allow in-app installs (switch `installMode` in
  `apps/desktop/src/main/main.ts` as part of 5.2).
- Packaged-app tests point an app at a local feed with
  `SAGASPINE_TEST_UPDATE_FEED`, which accepts only a loopback HTTP address.

## First launch of an unsigned build

Paste this into the release notes until builds are signed:

> **Opening SagaSpine for the first time.** This build is not yet signed, so
> your computer will warn you once.
>
> - **Windows:** if "Windows protected your PC" appears, click **More info**,
>   then **Run anyway**.
> - **macOS:** open SagaSpine once and close the warning. Then open
>   **System Settings → Privacy & Security**, scroll to Security, click
>   **Open Anyway** next to SagaSpine, and confirm. If macOS says SagaSpine
>   "is damaged", move it to Applications and run
>   `xattr -dr com.apple.quarantine /Applications/SagaSpine.app` in Terminal.
> - **Linux:** make the AppImage executable (`chmod +x`) and run it.
