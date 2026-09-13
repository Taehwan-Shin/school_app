// v0.140: web ESLint 관문 (Codex v0.138 소프트 권고 반영).
// functions/eslint.config.js 대칭. custom rule 없이 minimal — 파서만 등록해서
// syntax error · TypeScript 파서 호환성만 검증. 향후 rule 추가 시 slice 별
// 처리.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // 기존 코드에 이미 exhaustive-deps 를 인식하고 의도적으로 disable 하는
      // 주석 4곳이 존재. warn 으로 켜서 그 주석들이 실제 계약을 가지도록.
      // (error 로 켜면 지금 눈에 안 보이는 위반이 나올 수 있어 warn 유지.)
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
