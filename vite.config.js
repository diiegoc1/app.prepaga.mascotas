import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Multi-página: cada HTML de la raíz es una entrada (se preserva la
// estructura actual sin mover archivos). `base: './'` genera rutas
// relativas para que el build funcione en cualquier sub-ruta.
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
        usuarios: resolve(__dirname, "usuarios.html"),
      },
    },
  },
});
