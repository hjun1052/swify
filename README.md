## Swify

Swify는 웹에서 최신 정보를 모아 짧은 러닝 영상을 자동 생성하는 실험적인 Next.js 애플리케이션입니다. DuckDuckGo 검색 + Puppeteer 크롤링으로 컨텍스트를 만들고, OpenAI API로 스크립트/질문 답변을 생성합니다. Prisma + SQLite로 사용자, 저장 영상, 히스토리를 관리합니다.

---

## 요구 사항

- Node.js 20+
- npm (또는 pnpm/bun 사용 가능)
- OpenAI API Key
- 로컬 크롬 의존성을 설치한 환경 (Puppeteer 사용)

---

## 설치

```bash
npm install
```

루트에 `.env` 혹은 `.env.local`이 없으면 아래 단계를 따라 생성합니다.

1. `.env`  
   ```ini
   DATABASE_URL="file:./dev.db"
   ```
   Prisma는 `prisma.config.ts`에서 이 값을 읽어 SQLite 파일을 생성합니다.

2. `.env.local`  
   ```ini
   OPENAI_API_KEY=sk-...
   ```
   서버 라우트(`src/lib/openai.ts`, `src/app/api/ask/route.ts`)가 직접 이 값을 사용합니다. 저장소에는 포함하지 말고 개인 키를 넣어 주세요.

필요하면 `.env.example`을 참고해 키 이름만 맞춰 복사합니다.

---

## 데이터베이스 초기화

```bash
npx prisma db push        # 스키마 동기화 및 SQLite 파일 생성
npx prisma db seed        # (선택) 기본 사용자 생성
```

SQLite 파일은 루트 `dev.db`로 생성되며 gitignore 되어 있습니다.

---

## 개발 서버

```bash
npm run dev
```

http://localhost:3000 에 접속합니다. Puppeteer가 처음 실행될 때 Chromium을 다운로드하므로, 서버를 처음 띄울 때 잠시 시간이 걸릴 수 있습니다. 리눅스 환경이라면 `libnss3`, `libx11`, `fonts-liberation` 등의 기본 패키지가 설치돼 있어야 합니다.

---

## 주요 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 |
| `npm run build` | 프로덕션 번들 생성 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |

---

## 배포 시 주의 사항

- `.env*`는 전부 gitignore 대상입니다. 서버 환경에 `OPENAI_API_KEY`와 `DATABASE_URL`을 주입해야 합니다.
- Puppeteer를 서버리스 환경에서 사용하려면 실행 권한, 폰트, sandbox 설정 등을 추가로 조정해야 합니다. (Vercel Edge/Serverless 환경에서는 권장하지 않습니다.)
- Prisma SQLite는 단일 인스턴스 개발용입니다. 멀티 인스턴스 배포 시 PostgreSQL 등으로 마이그레이션하고 `DATABASE_URL`을 해당 커넥션 문자열로 교체해야 합니다.
