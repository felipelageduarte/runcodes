import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import EditorWorker from "../../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker";
import JsonWorker from "../../../../node_modules/monaco-editor/esm/vs/language/json/json.worker.js?worker";
import CssWorker from "../../../../node_modules/monaco-editor/esm/vs/language/css/css.worker.js?worker";
import HtmlWorker from "../../../../node_modules/monaco-editor/esm/vs/language/html/html.worker.js?worker";
import TsWorker from "../../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";

// @monaco-editor/react defaults to loading Monaco from a CDN (jsdelivr) —
// violates the CSP 'self' this app needs (docs/frontend/security.md).
// Point it at the npm package already in our own bundle instead.
loader.config({ monaco });

// O bundler deste projeto (Rolldown, via Vite 8) não resolve o
// specifier do worker com um bare import de dentro de node_modules
// (nem com `?worker` nem com `new URL("monaco-editor/...") +
// import.meta.url` — os dois jeitos documentados pro Vite clássico
// falham: "failed to resolve import"). O que resolve é apontar pro
// arquivo real dentro de node_modules por caminho relativo — aí o
// Rolldown trata como um módulo normal do grafo e gera o chunk de
// worker certinho (confirmado no build: editor/json/css/html/ts.worker
// saem como chunks próprios). Nenhuma das linguagens do catálogo atual
// (Python, C, C++, Java, Makefile) usa os workers de json/css/html/ts,
// mas ligá-los não custa nada e evita o mesmo problema se um dia uma
// linguagem com language-service de worker entrar no catálogo.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case "json":
        return new JsonWorker();
      case "css":
      case "scss":
      case "less":
        return new CssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new HtmlWorker();
      case "typescript":
      case "javascript":
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};
