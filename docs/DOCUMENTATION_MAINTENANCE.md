# Documentation Maintenance Guide

## Overview

This guide provides instructions for keeping Cancionero's documentation synchronized with code changes. It is designed for both GitHub Copilot and Google AI Studio to ensure documentation remains accurate and up-to-date with each iteration.

## Documentation Structure

All documentation is located in the `/docs` directory and organized by category:

```
docs/
├── getting-started/          # User quick-start guides
├── features/                 # Feature descriptions and functionality
├── development/              # Developer setup and technical implementation
├── deployment/               # Deployment and DevOps documentation
├── styling/                  # CSS architecture and design system
├── accessibility/            # Accessibility guidelines and testing
├── automation/               # Release automation and versioning workflows
├── changelog/                # Version history and semantic versioning
└── content/                  # Content management guidelines
```

## When to Update Documentation

Update documentation in these scenarios:

### 1. New Features Added
When a new feature is implemented:
- Add description in `/docs/features/README.md`
- Create feature-specific guide if needed
- Add keyboard shortcuts to `/docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md`
- Update feature screenshots/videos if user-facing
- Update main README.md features section

### 2. Code Architecture Changes
When significant code structure changes:
- Update `/docs/development/IMPLEMENTATION_REPORT.md`
- Update relevant component documentation
- Document new service or utility in `/docs/development/`
- Update any affected architecture diagrams

### 3. Deployment Process Changes
When CI/CD or deployment changes:
- Update `/docs/deployment/README.md`
- Update `/docs/automation/README.md` if workflow changes
- Update version/release documentation if applicable

### 4. CSS/Styling Updates
When CSS variables or design system changes:
- Update `/docs/styling/CSS_VARIABLES_INDEX.md`
- Update `/docs/styling/CSS_DESIGN_SYSTEM.md`
- Update `/docs/styling/CSS_ARCHITECTURE.md` if structure changes

### 5. Development Workflow Changes
When git commit conventions or development workflow changes:
- Update `/docs/development/COMMIT_GUIDE.md`
- Update `/docs/development/SECRETS_CONFIGURATION.md` if auth changes
- Update `.github/PULL_REQUEST_TEMPLATE.md` if PR requirements change

## Guidelines for AI Assistants (Copilot & Google AI Studio)

### Before Starting Implementation

1. Review the feature/change scope
2. Identify which documentation files need updates
3. Plan documentation alongside code changes

### During Implementation

1. Document changes as code is written
2. Keep documentation accurate and in sync
3. Do not defer documentation to "later"
4. Create new documentation files only when necessary

### Documentation Writing Standards

**General Requirements:**
- Write in Markdown (.md) format
- Use clear, concise English language
- No emojis in documentation text
- Use code blocks with language syntax highlighting
- Include examples where helpful
- Number headings hierarchically (H1, H2, H3)

**Functional Descriptions:**
- Explain what the feature does
- Describe user benefits
- Include typical use cases
- Provide step-by-step instructions where applicable

**Developer Sections:**
- Include technical implementation details
- Document API endpoints or functions
- Show code examples and snippets
- Include relevant file paths
- Explain configuration options

**User Manuals:**
- Provide clear, simple instructions
- Include relevant UI screenshots or short videos
- Use Playwright for automated screenshot capture
- Provide keyboard shortcuts
- Include troubleshooting tips

### Screenshot and Video Capture

For user-facing documentation, include visual demonstrations:

**Screenshots:**
```bash
# Using Playwright for automated screenshots
npx playwright codegen http://localhost:3000
```

**Videos:**
- Keep videos under 30 seconds
- Show essential user interactions
- Use clear narration or captions
- Store videos in `/docs/assets/videos/`
- Reference in markdown with relative paths

**Example video reference in markdown:**
```markdown
See this feature in action: [Feature Demo](assets/videos/feature-demo.mp4)
```

### File Naming Conventions

- Use uppercase for document names: `FILENAME.md`
- Use descriptive names: `KEYBOARD_SHORTCUTS_GUIDE.md` not `shortcuts.md`
- Use underscores to separate words
- Index files are always `README.md`

### Cross-References

Link between documentation files consistently:

```markdown
[Link text](../other-category/FILENAME.md)
```

## Verification Checklist for Each Change

After implementing a feature or making changes, verify:

- [ ] All new code is documented
- [ ] Feature is added to `/docs/features/README.md`
- [ ] User-facing changes have screenshots/videos if applicable
- [ ] API/function documentation is updated if applicable
- [ ] Configuration changes are documented
- [ ] Related README files are updated
- [ ] Links between documentation files are correct
- [ ] No broken cross-references exist
- [ ] Markdown syntax is valid
- [ ] No emojis appear in documentation

## Key Documentation Files

### Main Entry Points

| File | Purpose |
|------|---------|
| `README.md` | Repository main entry point with links to all documentation |
| `docs/README.md` | Documentation hub with overview of all sections |

### User Documentation

| File | Purpose |
|------|---------|
| `docs/getting-started/QUICKSTART.md` | Quick start guide for new users |
| `docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md` | Keyboard shortcuts reference |
| `docs/getting-started/CHEATSHEET.md` | Quick reference cheatsheet |

### Developer Documentation

| File | Purpose |
|------|---------|
| `docs/development/README.md` | Developer setup and overview |
| `docs/development/COMMIT_GUIDE.md` | Git commit conventions |
| `docs/development/SECRETS_CONFIGURATION.md` | Environment variables and secrets |
| `docs/development/IMPLEMENTATION_REPORT.md` | Technical implementation details |

### Deployment Documentation

| File | Purpose |
|------|---------|
| `docs/deployment/README.md` | Deployment overview |
| `docs/deployment/GITHUB_PAGES_CLOUDFLARE_SETUP.md` | Hosting setup guide |
| `docs/deployment/SEO_IMPLEMENTATION.md` | SEO configuration |

### Design and Styling

| File | Purpose |
|------|---------|
| `docs/styling/README.md` | CSS and styling overview |
| `docs/styling/CSS_DESIGN_SYSTEM.md` | Design tokens and color system |
| `docs/styling/CSS_VARIABLES_INDEX.md` | Complete CSS variables reference |

## Workflow for Copilot Sessions

1. Review the task/feature request
2. Check relevant documentation files
3. Implement changes in parallel with documentation updates
4. Update documentation immediately after code changes
5. Verify documentation is correct before committing
6. Include documentation updates in same commit/PR as code

## Workflow for Google AI Studio

1. Analyze the implementation request
2. Identify all affected documentation sections
3. Create/update documentation for each section
4. Generate code based on documented specifications
5. Test documentation accuracy matches implementation
6. Provide documentation and code together

## Common Documentation Patterns

### Feature Documentation Template

```markdown
# Feature Name

## Overview
Brief description of the feature and its purpose.

## Functional Description
What the feature does and how it benefits users.

## How to Use
Step-by-step user instructions.

## Developer Details
Technical implementation information.

## Examples
Code examples and use cases.

## Related Features
Links to related documentation.
```

### Keyboard Shortcut Entry

```markdown
### Ctrl+Shift+X - Feature Name
Description of what the shortcut does.
Available in: [List contexts where available]
```

### Code Example Format

```markdown
### Example: Feature Name
Description of the example.

\`\`\`typescript
// Example code here
const example = true;
\`\`\`
```

## Maintenance Schedule

- Review documentation weekly during active development
- Update documentation immediately when features change
- Audit complete documentation monthly
- Update screenshots/videos quarterly or after major UI changes

## Handling Outdated Documentation

When documentation becomes outdated:

1. Create an issue describing what is outdated
2. Update the documentation immediately
3. Test that examples still work
4. Verify cross-references are correct
5. Mark as resolved with commit reference

## Questions or Clarifications?

Refer to the specific documentation file for detailed information. When in doubt:
- Check the style guide in `/docs/DOCUMENTATION_GUIDE.md`
- Review similar documentation for patterns
- Test examples before including them
- Ask for clarification rather than guessing
