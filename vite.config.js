import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        cliente: resolve(__dirname, "cliente.html"),
        mascotas: resolve(__dirname, "mascotas.html"),
        planes: resolve(__dirname, "planes.html"),
        contratos: resolve(__dirname, "contratos.html"),
        usuarios: resolve(__dirname, "usuarios.html"),
        configuracion: resolve(__dirname, "configuracion.html"),
        restablecer: resolve(__dirname, "restablecer.html"),
      },
    },
  },
});