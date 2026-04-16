import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

const rootElement = document.getElementById("root")!;
rootElement.dataset.gravuLoaded = "true";
createRoot(rootElement).render(<App />);
