import { defineConfig } from 'vite';
// Sur GitHub Pages le site vit sous /antsim/ ; en local à la racine.
export default defineConfig({ base: process.env.GITHUB_ACTIONS ? '/antsim/' : '/' });
