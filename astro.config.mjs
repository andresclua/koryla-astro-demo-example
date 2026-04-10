import { defineConfig } from 'astro/config'

export default defineConfig({
  // Static output — no SSR needed for a test site
  output: 'static',
})
