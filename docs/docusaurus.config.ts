import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "run.codes",
  tagline: "Documentação do sistema run.codes — arquitetura, APIs e módulos",
  favicon: "img/favicon.ico",

  // NOTE: `v4: true` (and the rspack/SWC "faster" pipeline it pulls in) has
  // a real MDX directive-parsing bug as of 3.10.2 — content-dependent,
  // non-deterministic admonition (:::info/:::warning) rendering failures.
  // Reproduced in isolation (see runcodes-docs git history for the
  // bisection). Left off until that's fixed upstream.
  future: {
    v4: false,
  },

  url: "https://docs.run.codes",
  baseUrl: "/",

  organizationName: "runcodes-icmc",
  projectName: "runcodes-docs",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
  },
  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "run.codes docs",
      logo: {
        alt: "run.codes",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentação",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [],
      copyright: `run.codes — documentação do sistema. Build ${new Date().getFullYear()}.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
