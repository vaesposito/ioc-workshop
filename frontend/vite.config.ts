import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// function injectRuntimeConfigScriptForBuild() {
//   return {
//     name: "inject-runtime-config-script-for-build",
//     transformIndexHtml(html: string, context: { server?: unknown }): string {
//       if (context.server) {
//         return html;
//       }

//       const scriptTag = '<script src="/runtime-config.js"></script>';
//       if (html.includes(scriptTag)) {
//         return html;
//       }

//       return html.replace("</body>", `    ${scriptTag}\n  </body>`);
//     },
//   };
// }

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const parsedPort = Number.parseInt(env.VITE_APP_CLIENT_PORT ?? "", 10);
  const clientPort = Number.isFinite(parsedPort) ? parsedPort : 8001;

  return {
    plugins: [react(), tailwindcss()],
    base: "/ioc-workshop/",
    server: {
      port: clientPort,
      strictPort: true,
    },
    preview: {
      port: clientPort,
      strictPort: true,
    },
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: false,
      target: "es2020",
    },
  };
});
