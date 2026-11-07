# Google AI Studio Documentation Instructions

## Purpose

This document provides specific instructions for using Google AI Studio to maintain and generate Cancionero documentation. These instructions should be pasted into Google AI Studio at the beginning of each documentation maintenance session.

## Cancionero Project Context

**Project:** Cancionero - A web-based music composition manager built with React 19, Vite, and Tailwind CSS

**Repository:** tonybolanyo/cancionero

**Main Use Case:** Helping singers/songwriters organize and manage their musical compositions with chords, lyrics, and transposition features

**Tech Stack:**
- Frontend: React 19, Vite, Tailwind CSS
- Backend: Express.js (Node.js)
- Database: Firebase
- AI Features: Spotify integration, audio analysis
- Version Control: Git with semantic versioning

## Core Documentation Principles

1. All documentation goes in `/docs` directory
2. No emojis in documentation text
3. Markdown format only (.md files)
4. Clear separation between user and developer content
5. Include functional descriptions AND developer technical details
6. Screenshot/video demonstrations for user-facing features
7. Consistent file naming: `UPPERCASE_WITH_UNDERSCORES.md`

## Google AI Studio Session Instructions

### Starting a Session

Begin every documentation session with these steps:

1. Load this prompt
2. Ask: "What documentation needs to be created or updated?"
3. Review the file paths that need changes
4. Read the existing documentation structure
5. Follow the templates and patterns provided below

### Documentation Categories

Choose the appropriate category for each documentation file:

```
docs/getting-started/    - User quick-start guides, tutorials, shortcuts
docs/features/           - What the app can do, feature descriptions
docs/development/        - Developer setup, architecture, technical details
docs/deployment/         - Hosting, CI/CD, DevOps, environment setup
docs/styling/            - CSS system, design tokens, style architecture
docs/accessibility/      - Accessibility guidelines, WCAG compliance, testing
docs/automation/         - Release automation, versioning workflows
docs/changelog/          - Version history, semantic versioning
docs/content/            - Content management, metadata, catalog structure
```

### Before Writing Documentation

1. Understand the feature or change completely
2. Identify the target audience (users? developers? both?)
3. Determine the appropriate documentation file
4. Check if a similar doc exists to follow patterns
5. Plan: overview → use cases → instructions → technical details → examples

### Documentation Writing Process

#### Step 1: Plan the Structure
Determine what sections are needed:
- Overview/Purpose
- User instructions (if applicable)
- Technical details (if applicable)
- Examples
- Related features

#### Step 2: Write Clearly
- Use short, clear sentences
- Explain concepts before diving into details
- Provide concrete examples
- Answer "why" not just "how"

#### Step 3: Format Properly
```markdown
# Main Title (H1)

## Section Title (H2)

### Subsection (H3)

Regular paragraph text explaining the concept.

#### Code or Technical Detail (H4)

Brief description of code.

\`\`\`typescript
// Language specified in fence
const example = "code here";
\`\`\`

**Bold** for important terms
`code` for inline code references
```

#### Step 4: Review and Link
- Check all cross-references are correct
- Test relative links to other docs
- Verify no broken references
- Add to relevant README.md files

### Common Documentation Tasks

#### Task 1: Document a New Feature

**Target File:** `docs/features/README.md` + feature-specific file if large

**Template Structure:**
```markdown
## Feature Name

### What It Does
One sentence description of the feature.

### When to Use
Scenarios where users would use this feature.

### How to Use
Step-by-step instructions for users.

### Examples
Real examples or screenshots.

### Developer Information
Technical implementation details.

### Keyboard Shortcuts (if applicable)
List any shortcuts for this feature.

### Related Features
Links to related documentation.
```

#### Task 2: Document Developer Setup

**Target File:** `docs/development/README.md` or create new file

**Include:**
- Prerequisites (Node version, npm, etc.)
- Installation steps with exact commands
- Environment variable setup
- How to run tests/linting
- Common issues and solutions
- Links to more detailed guides

#### Task 3: Document an API or Function

**Target File:** Create appropriate file in `docs/development/`

**Include:**
```markdown
## Function/API Name

### Signature
\`\`\`typescript
function name(param1: Type, param2: Type): ReturnType
\`\`\`

### Parameters
- param1 (Type): Description
- param2 (Type): Description

### Returns
Description of return value

### Example
\`\`\`typescript
// Real usage example
\`\`\`

### Related
Links to related functions/APIs
```

#### Task 4: Update Feature List

**Target File:** `README.md` (root)

**Pattern:**
- Keep main features list current
- Link to feature docs in `/docs/features/`
- Update when new features launch
- Remove deprecated features

#### Task 5: Create Keyboard Shortcut Documentation

**Target File:** `docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md`

**Format:**
```markdown
### Ctrl+Key - Feature Name
Description of what this shortcut does.

Available in:
- Context where it works
- Another context

Example:
Steps showing the shortcut in action
```

### Special Documentation Types

#### Screenshots/Videos

For user-facing documentation:

```markdown
## Screenshot Documentation
See this feature in action:
[Feature Demo](assets/videos/feature-demo.mp4)

Or with a screenshot:
![Feature screenshot showing X](assets/images/feature-name.png)
```

**How to Capture:**
- Use Playwright for automated screenshots: `npx playwright codegen http://localhost:3000`
- Keep videos under 30 seconds
- Store in `docs/assets/videos/` (create if needed)
- Use clear, descriptive filenames

#### Architecture Diagrams

For developer documentation:

```markdown
## System Architecture

\`\`\`
Component A --> Component B --> Component C
     |                             |
     +-----> Service Layer --------+
\`\`\`

Description of diagram.
```

#### Configuration Examples

For deployment/setup documentation:

```markdown
### Environment Configuration

Create `.env.local` file:

\`\`\`bash
VITE_API_URL=https://api.example.com
VITE_AUTH_TOKEN=your_token_here
FIREBASE_KEY=your_firebase_key
\`\`\`

Each variable explained:
- VITE_API_URL: The API endpoint for the application
- VITE_AUTH_TOKEN: Personal access token for authentication
```

## Quality Checklist for Every Doc

Before considering documentation complete:

- [ ] **Clarity:** Does a new reader understand the topic?
- [ ] **Completeness:** Are all necessary steps/details included?
- [ ] **Examples:** Does it include concrete examples?
- [ ] **Correctness:** Are all technical details accurate?
- [ ] **Links:** Do all cross-references work?
- [ ] **Formatting:** Is markdown syntax correct?
- [ ] **No Emojis:** Zero emojis in the text
- [ ] **Consistency:** Matches patterns in similar docs
- [ ] **Audience:** Is it written for the right audience?
- [ ] **Test:** Can someone follow the instructions successfully?

## Documentation Maintenance Rules

### Golden Rules
1. **Synchronize:** Documentation and code change together
2. **No Backlog:** Never defer documentation
3. **Update Immediately:** When code changes, update docs same session
4. **Test Examples:** Make sure all code examples work
5. **Verify Links:** Check all cross-references before committing

### Update Triggers
Automatically update documentation when:
- New features are added
- API endpoints change
- UI components are modified
- Keyboard shortcuts are added/changed
- Installation steps change
- Configuration options are modified
- Architecture changes significantly

### Common Mistakes to Avoid
- Writing vague instructions (be specific!)
- Forgetting to update related docs
- Including broken code examples
- Using outdated screenshots
- Linking to non-existent files
- Inconsistent formatting
- Over-complicated explanations
- Using emojis

## File Structure Reference

```
docs/
├── README.md                                    # Entry point
├── DOCUMENTATION_MAINTENANCE.md                 # Maintenance guide
├── DOCUMENTATION_GUIDE.md                       # Style guide
│
├── getting-started/
│   ├── README.md
│   ├── QUICKSTART.md
│   ├── KEYBOARD_SHORTCUTS_GUIDE.md
│   └── CHEATSHEET.md
│
├── features/
│   ├── README.md
│   └── FEATURE_NAME.md
│
├── development/
│   ├── README.md
│   ├── COMMIT_GUIDE.md
│   ├── SECRETS_CONFIGURATION.md
│   ├── IMPLEMENTATION_REPORT.md
│   └── IMPLEMENTATION_SUMMARY.md
│
├── deployment/
│   ├── README.md
│   ├── GITHUB_PAGES_CLOUDFLARE_SETUP.md
│   └── SEO_IMPLEMENTATION.md
│
├── styling/
│   ├── README.md
│   ├── CSS_DESIGN_SYSTEM.md
│   ├── CSS_VARIABLES_INDEX.md
│   └── CSS_ARCHITECTURE.md
│
├── accessibility/
│   ├── README.md
│   ├── ACCESSIBILITY.md
│   ├── TESTING_ACCESSIBILITY.md
│   └── CONTRIBUTING_ACCESSIBILITY.md
│
├── automation/
│   ├── README.md
│   └── VERSIONING_GUIDE.md
│
├── changelog/
│   ├── README.md
│   ├── VERSIONING.md
│   └── CHANGES.md
│
├── content/
│   ├── README.md
│   └── METADATA_GUIDE.md
│
└── assets/
    ├── images/
    └── videos/
```

## Example Session Workflow

### Scenario: Document New Spotify Integration Feature

1. **Understand the Feature**
   - Read the feature code/PR
   - Understand user workflow
   - Identify developer technical details

2. **Create User Documentation**
   - File: `docs/features/SPOTIFY_INTEGRATION.md`
   - Include: How to use, step-by-step
   - Add: Screenshots of the UI
   - Update: `docs/features/README.md` with link

3. **Create Developer Documentation**
   - File: `docs/development/SPOTIFY_INTEGRATION_TECHNICAL.md`
   - Include: API integration details
   - Add: Configuration requirements
   - Update: `docs/development/README.md` with link

4. **Update Main README**
   - Add feature to features list
   - Link to full documentation

5. **Update Keyboard Shortcuts (if applicable)**
   - File: `docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md`
   - Add any new shortcuts

6. **Review and Verify**
   - Check all links work
   - Test code examples
   - Verify no emojis
   - Check formatting

## Integration with Version Control

When committing documentation:

```bash
git add docs/
git commit -m "docs: Document new feature name

- Add user guide to docs/features/
- Add technical details to docs/development/
- Update README.md features section
- Update keyboard shortcuts guide

This keeps documentation synchronized with code changes."
```

## Questions During Session

If uncertain during documentation creation:

1. **"Is this clear to someone new?"** - Read it aloud
2. **"Is this technically accurate?"** - Check against code
3. **"Are examples correct?"** - Test them
4. **"Are links valid?"** - Click through them
5. **"Did I update all related docs?"** - Review checklist

## Ending a Session

Before finishing a documentation session:

1. Run documentation review: `find docs/ -name "*.md" | head -20`
2. Verify no broken links (check manually or with a tool)
3. Confirm all new files are in correct categories
4. Check that all examples are current
5. Ensure related README files were updated
6. Commit with descriptive message

## Resources

- Main README: `/README.md`
- Documentation Index: `/docs/README.md`
- Style Guide: `/docs/DOCUMENTATION_GUIDE.md`
- Maintenance Guide: `/docs/DOCUMENTATION_MAINTENANCE.md`

---

**Last Updated:** 2026-11-07
**Version:** 1.0
