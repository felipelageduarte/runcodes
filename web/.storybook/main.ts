import type { StorybookConfig } from "@storybook/react-vite";

// Documentation/visual-review tool only — not wired to Vitest or a
// browser test runner (see docs/frontend/testing.md: automated visual
// regression is a deliberate non-goal for now).
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/react-vite",
};
export default config;
