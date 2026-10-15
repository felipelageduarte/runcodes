import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "run.codes",
  tagline: "Documentação do run.codes — manual do usuário e documentação técnica",
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
  // Servido pela runcodes-api em /docs (manual público, admin-docs atrás
  // de sessão de admin) — ver docs.routes.ts lá. Build precisa casar com
  // esse prefixo; pra servir na raiz de um domínio próprio, sobrescreva
  // com DOCUSAURUS_BASE_URL=/ no build.
  baseUrl: process.env.DOCUSAURUS_BASE_URL ?? "/docs/",

  organizationName: "runcodes-icmc",
  projectName: "runcodes-docs",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
    hooks: {
      // O manual do usuário usa placeholders de screenshot
      // (/img/screenshots/*.png) que ainda serão capturados com o sistema
      // rodando — ver docs/SCREENSHOTS-TODO.md. Não pode quebrar o build.
      onBrokenMarkdownImages: "warn",
    },
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
        // Instância 1: Manual do usuário (público) — rota /manual
        docs: {
          path: "docs",
          routeBasePath: "manual",
          sidebarPath: "./sidebars.ts",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      // Instância 2: Documentação de administração/técnica — rota /admin-docs.
      // Rota separada de propósito: é a parte que vai ser embutida na área
      // restrita do admin, sem arrastar o manual público junto.
      {
        id: "admin",
        path: "admin",
        routeBasePath: "admin-docs",
        sidebarPath: "./sidebarsAdmin.ts",
      },
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
          sidebarId: "manualSidebar",
          position: "left",
          label: "Manual do usuário",
        },
        {
          type: "docSidebar",
          sidebarId: "adminSidebar",
          docsPluginId: "admin",
          position: "left",
          label: "Administração & técnica",
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
