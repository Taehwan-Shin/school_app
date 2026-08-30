# school_app

Google Sheets 위에서 돌던 두 Apps Script(계정관리·클래스룸관리) 를 파이어베이스 기반 웹앱으로 옮긴다.

- 무엇을·왜: [AGENTS.md](./AGENTS.md)
- 지금 열린 항목: [STATUS.md](./STATUS.md)
- 일지: [project_notes.md](./project_notes.md)
- 일꾼 오더: [docs/handoff/NEXT.md](./docs/handoff/NEXT.md)

## 훅 활성화 (클론 직후 매번)

```bash
git config core.hooksPath .githooks
```

이걸 안 하면 커밋 범위 가드가 **안 돈다**.
