import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 하위 경로(/web1/shorts-react/)에서도 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react()],
});
