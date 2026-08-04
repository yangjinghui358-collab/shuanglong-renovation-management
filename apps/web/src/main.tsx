import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { InterfaceTextProvider } from "./features/settings/InterfaceTextProvider";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><AppProviders><InterfaceTextProvider><RouterProvider router={router} /></InterfaceTextProvider></AppProviders></StrictMode>,
);
