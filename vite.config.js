import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 用相对路径,GitHub Pages 任意仓名皆可直挂
export default defineConfig({
  plugins: [react()],
  base: "./",
});
