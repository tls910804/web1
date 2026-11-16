import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cards from './src/data/cards.json';
import gloss from './src/data/gloss.json';
import stories from './src/data/stories.json';
import videos from './src/data/videos.json';

// 내용 버전: 빌드한 시각. 앱 안에 묶인 내용과 서버에 올리는 content.json이 같은 버전을 가져요.
const V = Date.now();

// GitHub Pages 하위 경로(/web1/shorts-react/)에서도 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  define: { __CONTENT_V__: V },
  plugins: [react(), {
    name: 'content-json', // 문장·영상·이야기를 content.json 하나로 묶어 함께 올려요(앱 업데이트 없이 내용 추가용)
    generateBundle() {
      const c = { v: V, cards, gloss, stories, videos };
      this.emitFile({ type: 'asset', fileName: 'content.json', source: JSON.stringify(c) });
    },
  }],
});
