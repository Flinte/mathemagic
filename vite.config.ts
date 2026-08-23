import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages liefert das Projekt unter /<repo-name>/ aus — ohne diesen Pfad
  // sucht index.html die Assets im Wurzelverzeichnis und die Seite bleibt weiß.
  base: '/mathemagic/',
  plugins: [react()],
})
