import React from 'react';

/**
 * CSS VARIABLES USAGE EXAMPLES
 * 
 * This file demonstrates how to use the comprehensive CSS variable system
 * in Cancionero components for theme-aware styling.
 */

// Example 1: Button Component with all states
export function ExampleButton() {
  return (
    <div className="space-y-4 p-6 bg-[var(--bg-surface)] rounded-lg">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        Button Examples
      </h3>

      {/* Primary Button */}
      <button className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] rounded-[var(--radius-md)] hover:bg-[var(--button-primary-hover-bg)] active:bg-[var(--button-primary-active-bg)] disabled:bg-[var(--button-primary-disabled-bg)] disabled:text-[var(--button-primary-disabled-text)] disabled:cursor-not-allowed transition-colors shadow-[var(--shadow-sm)]">
        Primary Button
      </button>

      {/* Secondary Button */}
      <button className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] rounded-[var(--radius-md)] hover:bg-[var(--button-secondary-hover-bg)] active:bg-[var(--button-secondary-active-bg)] transition-colors">
        Secondary Button
      </button>

      {/* Tertiary Button (Outline) */}
      <button className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-tertiary-bg)] text-[var(--button-tertiary-text)] border border-[var(--button-tertiary-border)] rounded-[var(--radius-md)] hover:bg-[var(--button-tertiary-hover-bg)] transition-colors">
        Tertiary Button
      </button>

      {/* Disabled Button */}
      <button disabled className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-disabled-bg)] text-[var(--button-primary-disabled-text)] rounded-[var(--radius-md)] cursor-not-allowed">
        Disabled Button
      </button>
    </div>
  );
}

// Example 2: Form Input Component
export function ExampleForm() {
  return (
    <div className="space-y-[var(--space-4)] p-[var(--space-6)] bg-[var(--bg-surface)] rounded-[var(--radius-lg)] max-w-md">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        Contact Form
      </h3>

      {/* Input Group */}
      <div>
        <label className="block text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--text-primary)] mb-[var(--space-2)]">
          Email
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full px-[var(--space-3)] py-[var(--space-2)] bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] rounded-[var(--radius-md)] placeholder-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 transition-colors"
        />
      </div>

      {/* Textarea */}
      <div>
        <label className="block text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--text-primary)] mb-[var(--space-2)]">
          Message
        </label>
        <textarea
          placeholder="Your message..."
          rows={4}
          className="w-full px-[var(--space-3)] py-[var(--space-2)] bg-[var(--input-bg)] text-[var(--input-text)] border border-[var(--input-border)] rounded-[var(--radius-md)] placeholder-[var(--input-placeholder)] focus:outline-none focus:border-[var(--input-border-focus)] transition-colors resize-none"
        />
      </div>

      {/* Disabled Input */}
      <div>
        <label className="block text-[var(--font-size-sm)] font-[var(--font-weight-medium)] text-[var(--text-primary)] mb-[var(--space-2)]">
          ID (Read-only)
        </label>
        <input
          type="text"
          value="12345"
          disabled
          className="w-full px-[var(--space-3)] py-[var(--space-2)] bg-[var(--input-disabled-bg)] text-[var(--input-disabled-text)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] cursor-not-allowed"
        />
      </div>
    </div>
  );
}

// Example 3: Card Component
export function ExampleCard() {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-[var(--radius-lg)] p-[var(--space-6)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--card-hover-border)] transition-all">
      <div className="flex items-center gap-[var(--space-4)] mb-[var(--space-4)]">
        <div className="w-12 h-12 bg-[var(--accent-subtle)] rounded-[var(--radius-lg)] flex items-center justify-center">
          <span className="text-[var(--accent-primary)] font-[var(--font-weight-bold)]">🎵</span>
        </div>
        <div>
          <h4 className="text-[var(--font-size-base)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
            Song Title
          </h4>
          <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)]">
            Artist Name
          </p>
        </div>
      </div>
      <p className="text-[var(--font-size-sm)] text-[var(--text-secondary)] leading-[var(--line-height-relaxed)] mb-[var(--space-4)]">
        A beautiful description of your song with rich typography and proper color contrast for all themes.
      </p>
      <div className="flex gap-[var(--space-2)]">
        <button className="flex-1 px-[var(--space-3)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] rounded-[var(--radius-md)] hover:bg-[var(--button-primary-hover-bg)] transition-colors text-[var(--font-size-sm)] font-[var(--font-weight-medium)]">
          Play
        </button>
        <button className="flex-1 px-[var(--space-3)] py-[var(--space-2)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] rounded-[var(--radius-md)] hover:bg-[var(--button-secondary-hover-bg)] transition-colors text-[var(--font-size-sm)] font-[var(--font-weight-medium)]">
          Save
        </button>
      </div>
    </div>
  );
}

// Example 4: Badge Component
export function ExampleBadges() {
  return (
    <div className="space-y-[var(--space-4)] p-[var(--space-6)]">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        Badges
      </h3>

      <div className="flex flex-wrap gap-[var(--space-2)]">
        {/* Primary Badge */}
        <span className="inline-flex items-center px-[var(--space-3)] py-[var(--space-1)] bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)] border border-[var(--badge-primary-border)] rounded-[var(--radius-full)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]">
          Featured
        </span>

        {/* Secondary Badge */}
        <span className="inline-flex items-center px-[var(--space-3)] py-[var(--space-1)] bg-[var(--badge-secondary-bg)] text-[var(--badge-secondary-text)] border border-[var(--badge-secondary-border)] rounded-[var(--radius-full)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]">
          Acoustic
        </span>

        {/* State Badges */}
        <span className="inline-flex items-center px-[var(--space-3)] py-[var(--space-1)] bg-[var(--state-success-bg)] text-[var(--state-success-text)] border border-[var(--state-success-border)] rounded-[var(--radius-full)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]">
          ✓ Published
        </span>

        <span className="inline-flex items-center px-[var(--space-3)] py-[var(--space-1)] bg-[var(--state-warning-bg)] text-[var(--state-warning-text)] border border-[var(--state-warning-border)] rounded-[var(--radius-full)] text-[var(--font-size-xs)] font-[var(--font-weight-semibold)]">
          ⚠ Draft
        </span>
      </div>
    </div>
  );
}

// Example 5: Alert/Message Component
export function ExampleAlerts() {
  return (
    <div className="space-y-[var(--space-4)] p-[var(--space-6)]">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        Status Messages
      </h3>

      {/* Success Alert */}
      <div className="bg-[var(--state-success-bg)] border-l-4 border-[var(--state-success-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
        <p className="text-[var(--state-success-text)] font-[var(--font-weight-semibold)] text-[var(--font-size-sm)]">
          ✓ Changes saved successfully!
        </p>
      </div>

      {/* Warning Alert */}
      <div className="bg-[var(--state-warning-bg)] border-l-4 border-[var(--state-warning-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
        <p className="text-[var(--state-warning-text)] font-[var(--font-weight-semibold)] text-[var(--font-size-sm)]">
          ⚠ This action cannot be undone
        </p>
      </div>

      {/* Error Alert */}
      <div className="bg-[var(--state-error-bg)] border-l-4 border-[var(--state-error-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
        <p className="text-[var(--state-error-text)] font-[var(--font-weight-semibold)] text-[var(--font-size-sm)]">
          ✗ Error: Failed to load data
        </p>
      </div>

      {/* Info Alert */}
      <div className="bg-[var(--state-info-bg)] border-l-4 border-[var(--state-info-border)] rounded-[var(--radius-md)] p-[var(--space-4)]">
        <p className="text-[var(--state-info-text)] font-[var(--font-weight-semibold)] text-[var(--font-size-sm)]">
          ℹ New version available
        </p>
      </div>
    </div>
  );
}

// Example 6: Code Block Component
export function ExampleCodeBlock() {
  const code = `const greeting = "Hello, Cancionero!";
console.log(greeting);`;

  return (
    <div className="p-[var(--space-6)] bg-[var(--bg-surface)]">
      <h3 className="text-[var(--font-size-lg)] font-[var(--font-weight-semibold)] text-[var(--text-primary)] mb-[var(--space-4)]">
        Code Example
      </h3>
      <pre className="bg-[var(--code-bg)] border border-[var(--code-border)] rounded-[var(--radius-lg)] p-[var(--space-4)] overflow-x-auto">
        <code className="text-[var(--code-text)] font-[var(--font-mono)] text-[var(--font-size-sm)] leading-[var(--line-height-relaxed)]">
          {code}
        </code>
      </pre>
    </div>
  );
}

// Example 7: Modal Component
export function ExampleModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] rounded-[var(--radius-md)] hover:bg-[var(--button-primary-hover-bg)] transition-colors"
      >
        Open Modal
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-[var(--modal-backdrop)] flex items-center justify-center p-[var(--space-4)] z-50">
          <div className="bg-[var(--modal-bg)] border border-[var(--modal-border)] rounded-[var(--radius-xl)] shadow-[var(--modal-shadow)] max-w-md w-full p-[var(--space-6)]">
            <h2 className="text-[var(--font-size-xl)] font-[var(--font-weight-bold)] text-[var(--text-primary)] mb-[var(--space-4)]">
              Modal Title
            </h2>
            <p className="text-[var(--text-secondary)] mb-[var(--space-6)]">
              This is a modal dialog with theme-aware colors and proper spacing using CSS variables.
            </p>
            <div className="flex gap-[var(--space-2)]">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] border border-[var(--button-secondary-border)] rounded-[var(--radius-md)] hover:bg-[var(--button-secondary-hover-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] rounded-[var(--radius-md)] hover:bg-[var(--button-primary-hover-bg)] transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Example 8: Typography Showcase
export function ExampleTypography() {
  return (
    <div className="space-y-[var(--space-8)] p-[var(--space-6)] bg-[var(--bg-surface)]">
      <h1 className="text-[var(--font-size-4xl)] font-[var(--font-weight-extrabold)] text-[var(--text-primary)] font-[var(--font-serif)] leading-[var(--line-height-tight)]">
        Heading Level 1
      </h1>

      <h2 className="text-[var(--font-size-3xl)] font-[var(--font-weight-bold)] text-[var(--text-primary)] font-[var(--font-serif)] leading-[var(--line-height-snug)]">
        Heading Level 2
      </h2>

      <h3 className="text-[var(--font-size-2xl)] font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        Heading Level 3
      </h3>

      <p className="text-[var(--font-size-base)] text-[var(--text-secondary)] leading-[var(--line-height-relaxed)] max-w-2xl">
        This is body text with primary colors. The typography system includes comprehensive spacing, sizing, and weight options that automatically adjust between light and dark themes.
      </p>

      <p className="text-[var(--font-size-sm)] text-[var(--text-muted)] leading-[var(--line-height-normal)]">
        This is secondary text with muted colors for less important information.
      </p>

      <div className="font-[var(--font-mono)] text-[var(--font-size-sm)] text-[var(--text-secondary)] bg-[var(--code-bg)] p-[var(--space-4)] rounded-[var(--radius-md)]">
        const fontFamily = var(--font-mono);
      </div>
    </div>
  );
}

// Example 9: Comprehensive Theme Demo
export function ExampleThemeDemo() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)] p-[var(--space-8)] bg-[var(--bg-canvas)]">
      <ExampleButton />
      <ExampleBadges />
      <ExampleCard />
      <ExampleAlerts />
      <ExampleTypography />
      <ExampleCodeBlock />
    </div>
  );
}

export default ExampleThemeDemo;
