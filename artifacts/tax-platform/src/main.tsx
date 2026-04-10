import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import watchSystemTheme, { applyTheme, loadSavedTheme } from "@/lib/theme";

const saved = loadSavedTheme();
applyTheme(saved.mode, saved.accent);
watchSystemTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
