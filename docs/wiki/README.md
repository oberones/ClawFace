# ClawFace Wiki Source

This folder contains the source pages for the ClawFace GitHub Wiki.

The README should stay concise and release-oriented. The wiki is the longer user
manual: setup details, troubleshooting, feature behavior, and contributor
onboarding.

## Pages

- `Home.md`
- `Getting-Started.md`
- `OpenClaw-Setup-Modes.md`
- `Gateway-Settings.md`
- `File-Server-URL.md`
- `Media-and-Path-Mapping.md`
- `Sessions-and-Chat.md`
- `Files-View.md`
- `Media-View.md`
- `Dreams.md`
- `Interface-Customization.md`
- `Troubleshooting.md`
- `FAQ.md`
- `Contributing.md`
- `_Sidebar.md`

## Publishing

GitHub Wikis are backed by a separate git repository. To publish these pages:

```bash
git clone git@github.com:oberones/ClawFace.wiki.git
cp docs/wiki/*.md ClawFace.wiki/
cd ClawFace.wiki
git add .
git commit -m "Populate ClawFace wiki"
git push
```

Keep this folder in sync with the live wiki when user-facing behavior changes.
