import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        'fg-primary': 'var(--fg-primary)',
        'fg-secondary': 'var(--fg-secondary)',
        'fg-muted': 'var(--fg-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'accent-primary': 'var(--accent-primary)',
        'accent-on-primary': 'var(--accent-on-primary)',
        'state-danger': 'var(--state-danger)',
        'state-success': 'var(--state-success)',
        'state-warning': 'var(--state-warning)',
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', 'Menlo', ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        // v0.103 가독성 개선: body 15→16 · small 13→14 (1 단계씩 확대).
        // h1/h2/h3/display 는 유지 — 헤딩은 이미 충분.
        display: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h1: ['32px', { lineHeight: '40px', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        small: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        micro: ['11px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.025em' }],
      },
    },
  },
  plugins: [],
}
