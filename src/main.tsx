import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill crypto.randomUUID for non-HTTPS environments (e.g. localhost HTTP)
if (typeof window !== "undefined" && window.crypto && !window.crypto.randomUUID) {
  window.crypto.randomUUID = function () {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c: any) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  } as () => `${string}-${string}-${string}-${string}-${string}`;
}

createRoot(document.getElementById("root")!).render(<App />);
