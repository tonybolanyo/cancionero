// Quick test guide for accessibility features
// Run these tests manually to verify keyboard shortcuts work correctly

## Keyboard Shortcuts Testing Guide

### Prerequisites
1. Build and run the app locally: `npm run dev`
2. Open the app in your browser
3. Make sure the browser is focused on the app

### Test Cases

#### 1. Display Keyboard Shortcuts Modal
- **Action**: Press `Shift + ?`
- **Expected Result**: Modal opens showing all available shortcuts organized by category
- **Cleanup**: Press `Esc` to close

#### 2. Toggle Theme
- **Action**: Press `Ctrl + T` (or `Cmd + T` on Mac)
- **Expected Result**: The theme toggles between light and dark mode
- **Verify**: Check that the page appearance changes

#### 3. Navigate with Tab
- **Action**: Press `Tab` multiple times
- **Expected Result**: 
  - Focus indicator (outline) appears on interactive elements
  - Focus moves through buttons, links, and inputs
  - Focus is visible at all times

#### 4. Skip Link
- **Action**: 
  1. Load the page
  2. Press `Tab` immediately (don't click anything)
- **Expected Result**: 
  - A "Saltar al contenido principal" link appears
  - Focus is on the skip link
  - You can navigate using arrow keys

#### 5. Close Modal with Keyboard
- **Action**:
  1. Open any modal or dialog
  2. Press `Esc`
- **Expected Result**: Modal closes and focus returns to the trigger button

#### 6. High Contrast Mode (System Level)
- **Action** (Windows):
  1. Settings > Ease of Access > High Contrast
  2. Turn on high contrast mode
  3. Reload the app
- **Expected Result**: Borders and focus indicators are more visible

#### 7. Reduced Motion (System Level)
- **Action** (macOS):
  1. System Preferences > Accessibility > Display
  2. Enable "Reduce motion"
  3. Reload the app
- **Expected Result**: Animations are significantly reduced or disabled

#### 8. Screen Reader Test (Optional)
- **Tools**: NVDA (Windows), JAWS, or VoiceOver (Mac)
- **Action**: Enable screen reader and navigate through the app
- **Expected**: All buttons and interactive elements are announced correctly

### Common Keyboard Commands

| Command | Purpose |
|---------|---------|
| `Tab` | Move to next focusable element |
| `Shift + Tab` | Move to previous focusable element |
| `Enter` / `Space` | Activate button or toggle |
| `Arrow Keys` | Navigate within components |
| `Esc` | Close modals or dialogs |
| `Ctrl + T` | Toggle theme |
| `Ctrl + G` | Open Git sync modal |
| `Shift + ?` | Show shortcuts help |

### Debugging Tips

1. **Check Focus Visible Style**
   - Open DevTools (F12)
   - Select an interactive element
   - Look for a focused pseudo-class style in the Styles panel
   - Should show an outline in the accent color

2. **Check ARIA Attributes**
   - In DevTools, inspect an interactive element
   - Look for attributes like `aria-label`, `role`, `aria-modal`
   - Should match the element's purpose

3. **Check CSS Classes**
   - Elements may have `.sr-only` class (for screen reader only content)
   - Focus visible elements may have specific styles applied

### Known Limitations

- Some complex animations may need further optimization for reduced-motion preference
- Verify all new components follow the accessibility patterns established

### Success Criteria

✅ All keyboard shortcuts work as documented
✅ Tab navigation cycles through all interactive elements
✅ Focus indicators are always visible
✅ Modals can be closed with Escape key
✅ Screen reader announces elements correctly
✅ System preferences (high contrast, reduced motion) are respected
