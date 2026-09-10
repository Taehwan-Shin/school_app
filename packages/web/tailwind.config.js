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
        // semantic 토큰 (Say Briefly 값이 var 뒤에서 공급됨)
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        'canvas-subtle': 'var(--bg-surface)', // subtle 배경 alias
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

        // Say Briefly 원시 팔레트 (신규 컴포넌트에서 직접 사용)
        'forest-ink': 'var(--color-forest-ink)',
        'highlighter-yellow': 'var(--color-highlighter-yellow)',
        'cream-paper': 'var(--color-cream-paper)',
        'pencil-gray': 'var(--color-pencil-gray)',
        'whisper-gray': 'var(--color-whisper-gray)',
        'sticky-note-teal': 'var(--color-sticky-note-teal)',
        'sticky-note-mint': 'var(--color-sticky-note-mint)',
        'sticky-note-blush': 'var(--color-sticky-note-blush)',
        terracotta: 'var(--color-terracotta)',
      },
      fontFamily: {
        sans: ['Inter', '"Pretendard Variable"', 'Pretendard', ...defaultTheme.fontFamily.sans],
        display: ['"Bricolage Grotesque"', 'Archivo Black', 'Inter', ...defaultTheme.fontFamily.sans],
        mono: ['"Roboto Mono"', '"JetBrains Mono"', 'Menlo', ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        // Say Briefly 스케일
        micro: ['11px', { lineHeight: '1.3' }],
        caption: ['14px', { lineHeight: '1.5' }],
        'body-sm': ['16px', { lineHeight: '1.5' }],
        body: ['18px', { lineHeight: '1.5' }],
        'body-lg': ['20px', { lineHeight: '1.38' }],
        subheading: ['28px', { lineHeight: '1.25' }],
        'heading-sm': ['40px', { lineHeight: '1.1' }],
        heading: ['55px', { lineHeight: '1', letterSpacing: '2.2px' }],
        'heading-lg': ['66px', { lineHeight: '1', letterSpacing: '3.3px' }],
        'display-xl': ['90px', { lineHeight: '1', letterSpacing: '4.5px' }],

        // 하위 호환 (기존 컴포넌트가 쓰던 이름)
        display: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h1: ['32px', { lineHeight: '40px', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '32px', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '28px', fontWeight: '600' }],
        small: ['13px', { lineHeight: '20px', fontWeight: '400' }],
      },
      borderRadius: {
        // Say Briefly 명세: buttons 6px · cards 12px · nav 16px · tags 9999
        buttons: '6px',
        cards: '12px',
        nav: '16px',
        tags: '9999px',
      },
      boxShadow: {
        // Say Briefly 최소 elevation
        subtle: 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px',
        'subtle-2': 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px',
      },
    },
  },
  plugins: [],
}
