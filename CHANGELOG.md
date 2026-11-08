# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-11-08

### 🎉 Features

- actualizar canción "Canción para los cuerdos" ([ee3747a](../../commit/ee3747a)) - Tony G. Bolaño

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-11-08

### 🐛 Bug Fixes

- sync lockfile with package manifest for CI\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com> ([6598a8d](../../commit/6598a8d)) - tonybolanyo

### 📚 Documentation

- add syllable-level chord sync documentation ([b150bd0](../../commit/b150bd0)) - Tony G. Bolaño
- sync and organize documentation ([ddd9b4f](../../commit/ddd9b4f)) - tonybolanyo

### 🔄 Other Changes

- Merge pull request #33 from tonybolanyo/fictional-funicular ([f97c244](../../commit/f97c244)) - Tony G. Bolaño
- feat ([a83ece3](../../commit/a83ece3)) - visualizer): improve song duration and video export (Tony G. Bolaño
- Merge pull request #32 from tonybolanyo/literate-doodle ([560521d](../../commit/560521d)) - Tony G. Bolaño
- Merge pull request #31 from tonybolanyo/automatic-enigma ([3a77f04](../../commit/3a77f04)) - Tony G. Bolaño
- feat ([535187f](../../commit/535187f)) - changelog): implement automated changelog generation in release pipeline (tonybolanyo

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.1] - 2026-11-01

### 🐛 Bug Fixes

- Check if tag already exists before creating release in GitHub Actions workflow
  - The release workflow was failing because it attempted to create a tag that already exists
  - Added validation to skip tag creation if it already exists
  - Only create GitHub release if tag was successfully created
  - Fixes the 'fatal: tag already exists' error in workflow job 124785325201
