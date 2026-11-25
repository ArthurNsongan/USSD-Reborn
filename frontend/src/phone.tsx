import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FullscreenPhone } from "./components/FullscreenPhone";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing in phone/index.html");

createRoot(root).render(
  <StrictMode>
    <FullscreenPhone />
  </StrictMode>,
);
