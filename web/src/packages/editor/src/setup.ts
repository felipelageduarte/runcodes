import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

// @monaco-editor/react defaults to loading Monaco from a CDN (jsdelivr) —
// violates the CSP 'self' this app needs (docs/frontend/security.md).
// Point it at the npm package already in our own bundle instead.
loader.config({ monaco });

// Sem MonacoEnvironment.getWorker, de propósito: o bundler deste projeto
// (Rolldown, via Vite 8) não resolve o specifier do worker de dentro de
// node_modules nem com `?worker` nem com `new URL(...) + import.meta.url`
// (os dois jeitos documentados pro Vite clássico) — falha no build.
// Sem worker configurado, o Monaco degrada pra tokenização na thread
// principal — zero diferença funcional aqui, porque nenhuma das
// linguagens do catálogo (Python, C, C++, Java, Makefile) tem *language
// service* baseado em worker no Monaco (isso só existe pra
// json/css/html/typescript); o worker nunca seria usado de verdade por
// essas linguagens mesmo se resolvesse. Revisitar se/quando o Rolldown
// resolver esse caso, ou se uma linguagem com language-service de
// worker entrar no catálogo.
