import { defineConfig } from 'vite';

// Relative asset paths so the build works from any sub-path (GitHub Pages, itch.io)
export default defineConfig({
  base: './'
});
