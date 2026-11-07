# User Documentation Visual Assets Guide

This guide explains how to create and maintain screenshots and videos for user-facing documentation in Cancionero.

## Overview

User documentation should include visual demonstrations of features:
- Screenshots for UI elements, menus, and workflows
- Short videos for interactive features and step-by-step processes
- Clear labels and minimal text overlays

## Storing Assets

Visual assets are organized in this directory structure:

```
docs/assets/
├── images/
│   ├── feature-name-screenshot.png
│   ├── workflow-step1.png
│   └── ui-element-demo.png
└── videos/
    ├── feature-demo.mp4
    ├── keyboard-shortcut.mp4
    └── workflow-tutorial.mp4
```

## Creating Screenshots

### Using Playwright

Playwright provides automated screenshot capture with precise control:

```bash
# Install Playwright (if not already installed)
npm install -D @playwright/test

# Open Codegen to record interactions and capture screenshots
npx playwright codegen http://localhost:3000
```

### Manual Screenshot Process

1. Start the application: `npm run dev`
2. Navigate to the feature/page to capture
3. Use your OS screenshot tool (or Playwright)
4. Save to `docs/assets/images/` with descriptive name
5. Reference in markdown documentation

### Screenshot Best Practices

- Capture full-page or focused element depending on context
- Use clear file names: `feature-name-screenshot.png`
- Keep image dimensions reasonable (max 1200px wide)
- Highlight important UI elements if needed
- Avoid sensitive information in screenshots

### Embedding Screenshots in Markdown

```markdown
## Feature Demonstration

Here's how the search feature works:

![Search interface showing song list](assets/images/search-interface.png)

The search box accepts:
- Song titles
- Lyrics
- Artist names
- Tonality (e.g., "C major")
```

## Creating Videos

### Video Requirements

- Duration: Under 30 seconds (ideal)
- Maximum: 60 seconds
- Format: MP4 or WebM
- Resolution: 1280x720 or higher
- Clear, consistent pacing
- No background noise (add captions or voiceover if needed)

### Creating Screen Recordings

#### Option 1: Using Playwright (Recommended)

Playwright can record videos of test sessions:

```bash
# Install dependencies
npm install -D @playwright/test

# Create a test script that performs actions and records
```

Example Playwright recording script:

```typescript
import { test } from '@playwright/test';

test('record feature demo', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Perform actions
  await page.fill('input[placeholder="Search"]', 'Feature name');
  await page.click('button:has-text("Search")');
  
  // Video is automatically recorded if configured
  await page.waitForTimeout(2000);
});
```

Run with video recording:

```bash
PWVIDEO=1 npx playwright test
```

#### Option 2: Desktop Recording Tools

- **macOS**: QuickTime Player (built-in)
- **Windows**: Xbox Game Bar or OBS
- **Linux**: SimpleScreenRecorder or OBS
- **Cross-platform**: OBS Studio (free, open-source)

### Recording Best Practices

1. Close notifications and unnecessary applications
2. Record at consistent speed (not too fast, not too slow)
3. Show the complete workflow from start to finish
4. Highlight important clicks or keyboard shortcuts with cursor movement
5. Include brief pauses to let viewers process information
6. Test video in browser before committing

### Video Editing

For short edits or improvements:

- Trim beginning/end: FFmpeg
- Add captions: FFmpeg or video editors
- Compress: Handbrake or FFmpeg

Example FFmpeg commands:

```bash
# Trim video (10-45 seconds)
ffmpeg -i input.mp4 -ss 10 -to 45 -c copy output.mp4

# Convert to WebM for better web compression
ffmpeg -i input.mp4 -c:v libvpx-vp9 -b:v 0 -crf 30 output.webm

# Compress to reduce file size
ffmpeg -i input.mp4 -vf "scale=1280:-1" -b:v 2M output.mp4
```

## Embedding Videos in Markdown

### Basic Video Link

```markdown
See this feature in action: [Feature Demo](assets/videos/feature-demo.mp4)
```

### HTML5 Video Player

For better control:

```html
<video width="600" controls>
  <source src="assets/videos/feature-demo.mp4" type="video/mp4">
  Your browser does not support HTML5 video.
</video>
```

### Video with Description

```markdown
## Feature Demo

This video shows how to use the keyboard shortcut for quick access:

[Feature Demo Video](assets/videos/feature-demo.mp4)

**Steps shown:**
1. Press Ctrl+Shift+X
2. Search interface appears
3. Type to filter results
4. Select desired item

**Duration:** 15 seconds
```

## When to Use Screenshots vs Videos

### Use Screenshots For

- Static UI elements (buttons, menus, layouts)
- Reference documentation
- Complex layouts that need exploration
- Before/after comparisons
- Error messages or alerts
- Settings and configuration screens

### Use Videos For

- Multi-step workflows
- Interactive features
- Keyboard shortcut demonstrations
- Real-time updates or animations
- Search and filter interactions
- File uploads or drag-and-drop

## File Size Considerations

### Screenshot Optimization

- PNG for graphics/UI: 50-200 KB typical
- JPEG for photos: 30-150 KB typical
- Optimize with tools like TinyPNG

### Video Optimization

Aim for files under 5 MB:

```bash
# Compress MP4 to reduce size
ffmpeg -i input.mp4 -vf "scale=1280:-1" -b:v 1500k -maxrate 1500k -bufsize 3000k output.mp4

# Use WebM for better compression
ffmpeg -i input.mp4 -c:v libvpx-vp9 -b:v 800k output.webm
```

## Accessibility Guidelines

### Screenshots

- Include alt text in markdown: `![Description](image.png)`
- Alt text should describe what's shown and its purpose
- Avoid using text-only descriptions

### Videos

- Include captions or transcript
- Describe important visual elements
- Avoid flashing or rapid changes
- Use clear, high-contrast colors

## Maintenance Schedule

- Update screenshots monthly or when UI changes significantly
- Update videos quarterly or when features change
- Test all video/image links weekly during development
- Archive old videos/screenshots when features are deprecated

## Common Issues and Solutions

### Video Won't Play in Browser

- Check video format (MP4 should work universally)
- Verify file path is correct in markdown
- Check file size isn't too large
- Test in multiple browsers

### Screenshot Looks Blurry

- Capture at 100% zoom
- Use PNG format for crisp quality
- Check screen resolution
- Avoid scaling after capture

### File Size Too Large

- Compress with FFmpeg or online tools
- Reduce resolution if possible
- Use video format instead of multiple images
- Remove unnecessary parts before capture

## Tools Reference

| Task | Recommended Tool | Command |
|------|------------------|---------|
| Screenshot | Playwright | `npx playwright codegen` |
| Video Recording | OBS Studio | Free, cross-platform |
| Video Compression | FFmpeg | `ffmpeg -i input.mp4...` |
| Image Compression | TinyPNG | Online or CLI |
| Video Trimming | FFmpeg | `ffmpeg -ss -to` |
| Format Conversion | FFmpeg | `ffmpeg -i input -c...` |

## Example Documentation with Assets

```markdown
# Search Feature

## Overview
Search allows you to quickly find songs by title, lyrics, artist, or tonality.

## How to Use

### Method 1: Text Search

![Search box at top of page](assets/images/search-box.png)

1. Click the search box
2. Type your search query
3. Results filter automatically

### Method 2: Using Keyboard Shortcut

[Video showing Ctrl+F shortcut](assets/videos/search-shortcut-demo.mp4)

**Tip:** Use Ctrl+F on Windows/Linux or Cmd+F on Mac for instant search.

## Advanced Filtering

![Search filters showing tonality options](assets/images/search-filters.png)

- Filter by tonality (C, G, D, etc.)
- Filter by genre
- Filter by tempo range
```

## Updating Documentation Assets

When updating documentation:

1. Create or update screenshots/videos
2. Store in appropriate directory
3. Reference in markdown with correct relative paths
4. Test links before committing
5. Include in same commit as documentation changes

## Getting Help

If you need to capture complex workflows:

1. Break into smaller, simpler steps
2. Create multiple videos if needed
3. Use clear, descriptive titles
4. Include text descriptions alongside videos
5. Test in multiple browsers before committing

---

**Last Updated:** 2026-11-07
**Version:** 1.0
