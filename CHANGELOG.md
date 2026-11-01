# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-11-01

### Fixed
- Check if tag already exists before creating release in GitHub Actions workflow
  - The release workflow was failing because it attempted to create a tag that already exists
  - Added validation to skip tag creation if it already exists
  - Only create GitHub release if tag was successfully created
  - Fixes the 'fatal: tag already exists' error in workflow job 124785325201
