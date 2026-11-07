# Copilot Documentation Maintenance Guide

## Quick Reference

This guide helps Copilot maintain Cancionero's documentation in sync with code changes during GitHub Copilot sessions.

### Key Rules
1. All documentation in `/docs` - organized by category
2. No emojis in documentation text
3. Markdown format (.md files)
4. Update docs simultaneously with code changes
5. Follow existing patterns for consistency
6. Include both functional AND developer details

## Categorized Documentation Locations

```
docs/getting-started/    - User guides, quickstart, keyboard shortcuts
docs/features/           - Feature descriptions and demonstrations
docs/development/        - Developer setup, technical implementation
docs/deployment/         - Hosting, CI/CD, deployment pipelines
docs/styling/            - CSS variables, design system, architecture
docs/accessibility/      - Accessibility guidelines and WCAG compliance
docs/automation/         - Release workflows, versioning automation
docs/changelog/          - Version history and semantic versioning
docs/content/            - Content management and metadata
```

## When to Update Documentation

### Automatic Update Scenarios

Update documentation immediately when:

| Change Type | Documentation File | Update Details |
|-------------|-------------------|-----------------|
| New Feature | `docs/features/README.md` | Add feature description |
| New Feature | `README.md` (root) | Add to features list if user-facing |
| New Keyboard Shortcut | `docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md` | Add shortcut entry |
| Code Architecture Change | `docs/development/IMPLEMENTATION_REPORT.md` | Document new architecture |
| New Development Tool | `docs/development/README.md` | Add to setup instructions |
| Deployment Config Change | `docs/deployment/README.md` | Update deployment steps |
| CSS Variable Addition | `docs/styling/CSS_VARIABLES_INDEX.md` | Add variable to reference |
| Environment Variable Addition | `docs/development/SECRETS_CONFIGURATION.md` | Document new variable |

## Quick Start: Common Tasks

### Task: Document a New Feature

1. Open feature description PR/issue to understand the feature
2. Add entry to `docs/features/README.md`
3. For complex features, create `docs/features/FEATURE_NAME.md`
4. Update `README.md` features list if user-facing
5. Add keyboard shortcut if applicable
6. Verify all links are correct

**Example Addition to docs/features/README.md:**
```markdown
## Feature Name

### What It Does
Brief description of what the feature does.

### How to Use
Step-by-step instructions for end users.

### Examples
Real-world usage scenarios.

### Developer Details
Technical implementation information.
```

### Task: Document a Code Architecture Change

1. Review the architecture change in the PR
2. Update `docs/development/IMPLEMENTATION_REPORT.md` with:
   - What changed
   - Why it changed
   - Impact on other components
3. Create/update affected component documentation
4. Update any relevant README files with links

### Task: Add an Environment Variable

1. Determine if it's user-facing or developer-only
2. Add to appropriate section of `docs/development/SECRETS_CONFIGURATION.md`:
   - Variable name
   - What it controls
   - Example value (no secrets!)
   - Required or optional
   - Default value if applicable
3. Update `.env.example` in root if user-facing
4. Document in feature docs if feature-specific

### Task: Update Keyboard Shortcuts

When adding/removing keyboard shortcuts:

1. Open `docs/getting-started/KEYBOARD_SHORTCUTS_GUIDE.md`
2. Add/remove entry in correct category
3. Use format:
```markdown
### Ctrl+Key - Feature Name
Description of what this shortcut does.

Available in:
- Context where it works
```
4. Update feature documentation if applicable
5. Update `CHEATSHEET.md` if included there

### Task: Document a New API Endpoint

When adding API endpoints (especially for development):

1. Create or update file in `docs/development/`
2. Document endpoint in this format:
```markdown
## Endpoint Name

### URL
GET /api/endpoint

### Parameters
- param1 (type): description

### Response
\`\`\`json
{
  "field": "value"
}
\`\`\`

### Example
\`\`\`bash
curl http://localhost:3000/api/endpoint
\`\`\`
```
3. Update relevant README with link

## Documentation Style Guide

### Formatting Rules

**Headers:**
```markdown
# Title (H1) - Use once per document
## Main Section (H2) - Top-level sections
### Subsection (H3) - Subsections
#### Minor Details (H4) - Use sparingly
```

**Emphasis:**
- `**Bold**` for important terms
- `*Italic*` for emphasis (use rarely)
- \`Code\` for code references

**Lists:**
```markdown
- Bullet point
  - Nested point
  - Another nested

1. Numbered item
2. Second item
   - Can mix with bullets
```

**Code Blocks:**
````markdown
\`\`\`typescript
// Specify language for syntax highlighting
const example = "code";
\`\`\`

\`\`\`bash
# Shell commands
npm run build
\`\`\`
````

**Links:**
```markdown
[Link Text](../other-directory/FILENAME.md)
[External Link](https://example.com)
```

### Writing Standards

1. **Be Clear:** Explain concepts simply
2. **Be Concise:** Use short sentences
3. **Be Complete:** Include all necessary details
4. **Be Consistent:** Follow existing patterns
5. **Be Correct:** Verify all information
6. **No Emojis:** Zero emoji characters
7. **Use Examples:** Show, don't just tell

### Tone and Voice

- Friendly but professional
- Explain "why" not just "how"
- Address the reader directly ("you")
- Use active voice: "Run the command" not "The command should be run"
- Include helpful tips and common issues

## File Organization Rules

### Naming Conventions
- Filenames: `UPPERCASE_WITH_UNDERSCORES.md`
- Index files: Always named `README.md`
- Clear, descriptive names: `KEYBOARD_SHORTCUTS_GUIDE.md` not `shortcuts.md`

### Directory Structure

Each category should have:
1. `README.md` - Overview and navigation
2. Specific guides and documentation files
3. Assets subdirectory if needed (images, videos)

### Cross-References

Link consistently:
- To sibling files: `[Link](FILENAME.md)`
- To parent: `[Link](../README.md)`
- To other categories: `[Link](../category/FILENAME.md)`
- Always verify links work

## Documentation Templates

### Feature Documentation Template

```markdown
# Feature Name

## Overview
One sentence description of what the feature does.

## Why This Feature Matters
Explain the benefit to users.

## How to Use

### Step 1: [First Step]
Description and any relevant UI details.

### Step 2: [Second Step]
Description and instructions.

### Examples
Real examples of using the feature.

## Keyboard Shortcuts
- Ctrl+Key - What it does (if applicable)

## Developer Details

### Technical Implementation
How the feature is built.

### Related Components
Files and components involved.

### Configuration
Any configuration needed.

## Troubleshooting
Common issues and solutions.

## Related Features
- [Link to related feature](../features/RELATED.md)
```

### Developer Guide Template

```markdown
# Topic Name

## Overview
What this guide covers.

## Prerequisites
What needs to be installed/configured first.

## Setup Steps

### Step 1: [Action]
Specific instructions.

### Step 2: [Action]
Specific instructions.

## Configuration
Environment variables or settings needed.

## Verification
How to verify the setup is correct.

## Troubleshooting

### Issue: [Problem]
Solution here.

## Related Documentation
- [Link](../other/FILENAME.md)
```

## Quality Verification Checklist

Before considering documentation complete:

```
Clarity:
  [ ] A new reader would understand this
  [ ] Examples are clear and helpful
  [ ] Concepts are explained before use

Correctness:
  [ ] All code examples are accurate
  [ ] All technical details match code
  [ ] No outdated information remains

Completeness:
  [ ] All necessary steps are included
  [ ] All related files are linked
  [ ] Nothing is assumed knowledge

Consistency:
  [ ] Matches style of similar docs
  [ ] Formatting is consistent
  [ ] Naming follows conventions

Quality:
  [ ] No typos or grammar errors
  [ ] No emojis anywhere in text
  [ ] All links work correctly
  [ ] Markdown syntax is valid
```

## Integration Points with README.md

The main `README.md` should link to documentation:

```markdown
## Documentation

- [Getting Started](docs/getting-started/)
- [Features](docs/features/)
- [Development Guide](docs/development/)
- [Deployment](docs/deployment/)
- [Styling System](docs/styling/)
- [Accessibility](docs/accessibility/)
```

Keep this list updated when:
- Adding major new documentation sections
- Removing documentation sections
- Significantly renaming sections

## Screenshots and Videos

For user-facing documentation:

### Screenshot Capture Process

1. Use Playwright for automated capture:
   ```bash
   npx playwright codegen http://localhost:3000
   ```

2. Reference in markdown:
   ```markdown
   ![Description of what's shown](assets/images/filename.png)
   ```

3. Store in: `docs/assets/images/`

### Video Capture Process

1. Record short demos (under 30 seconds)
2. Store in: `docs/assets/videos/`
3. Reference in markdown:
   ```markdown
   See this in action: [Demo Video](assets/videos/demo.mp4)
   ```

4. Use clear, descriptive filenames

## Common Documentation Patterns

### Parameter Documentation
```markdown
### Parameters
- `paramName` (Type): Description of what it does
- `anotherParam` (Type): What this controls
```

### Configuration Example
```markdown
### Configuration

Add to `.env.local`:

\`\`\`
VAR_NAME=value_here
ANOTHER_VAR=another_value
\`\`\`

- VAR_NAME: Explanation of this variable
- ANOTHER_VAR: Explanation of this variable
```

### Code Example
```markdown
### Example: Description

\`\`\`typescript
// Show practical example
const result = performAction();
console.log(result);
\`\`\`
```

### Keyboard Shortcut Entry
```markdown
### Ctrl+Shift+X - Feature Name

What this shortcut does in one sentence.

**Available in:**
- Context 1
- Context 2

**Example:**
Steps showing the shortcut in action.
```

## Workflow During Copilot Sessions

### At Start of Session
1. Read the feature/change description
2. Identify documentation files needing updates
3. Review relevant existing documentation
4. Plan documentation changes before coding

### During Implementation
1. Document changes as code is written
2. Keep documentation current with code
3. Do not accumulate documentation debt
4. Test documentation examples

### Before Committing
1. Review all documentation changes
2. Test all links and examples
3. Verify no emojis in text
4. Ensure consistency with style guide
5. Check that all related docs are updated

### Commit Message Format

```
feat: Add feature name

- Document feature in docs/features/
- Add technical details in docs/development/
- Update README.md features section
- Add keyboard shortcut to guide

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Dealing with Documentation Gaps

If documentation is incomplete:

1. **During a feature:** Create documentation immediately
2. **After a feature:** Update documentation before moving to next task
3. **Old features:** Create TODO comment in documentation
4. **Never:** Defer documentation "to be done later"

### TODO Pattern
```markdown
## TODO: Complete Documentation

This section needs:
- [ ] Add examples
- [ ] Add screenshots
- [ ] Add technical details

Tracked in: GitHub Issue #XXX
```

## Useful Commands

```bash
# Find documentation files
find docs/ -name "*.md" | sort

# Check for broken markdown
grep -r "](.*\.md)" docs/ | grep -v "http"

# Find missing documentation
grep -r "TODO" docs/

# Validate markdown syntax
npx markdownlint docs/**/*.md
```

## Reference Documents

- **Style Guide:** `/docs/DOCUMENTATION_GUIDE.md`
- **Maintenance Guide:** `/docs/DOCUMENTATION_MAINTENANCE.md`
- **Google AI Instructions:** `/docs/GOOGLE_AI_STUDIO_INSTRUCTIONS.md`
- **Main Entry Point:** `/README.md`
- **Documentation Hub:** `/docs/README.md`

## Quick Checklist Before Commit

- [ ] All new code has corresponding documentation
- [ ] Updated appropriate README files
- [ ] Verified no broken links
- [ ] Checked for emojis (none should exist)
- [ ] Followed style guide
- [ ] Tested code examples
- [ ] Consistent with existing patterns
- [ ] Documentation is clear and complete

---

**Version:** 1.0
**Last Updated:** 2026-11-07
