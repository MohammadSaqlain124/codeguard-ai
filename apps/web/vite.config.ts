import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Port 5173 is Vite's default and it is already what the API's CORS_ORIGIN
// allows, so leaving it alone means no backend change is needed to run this.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
