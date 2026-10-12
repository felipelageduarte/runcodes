import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, getInitialTheme } from "@runcodes/shared";
import "./index.css";
import App from "./App";

applyTheme(getInitialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
