## Swify 평가 가이드

심사위원님께서 직접 설치·구동해 기능을 확인할 수 있도록 작성한 문서입니다. Swify는 최신 검색 결과와 OpenAI API를 이용해 짧은 학습 영상을 자동으로 스크립트화하고, 질문까지 처리하는 Next.js 애플리케이션입니다.

---

## 빠른 평가 체크리스트

1. **의존성 설치** – `npm install`
2. **환경 변수 준비**
   - `.env` : `DATABASE_URL="file:./dev.db"`
   - `.env.local` : 메일로 제공한 파일을 사용해주세요.
3. **Prisma 초기화** – `npx prisma db push` 후 필요하면 `npx prisma db seed`
4. **개발 서버 실행** – `npm run dev`, 브라우저에서 `http://localhost:3000` 접속
5. **시나리오 테스트**
   - 검색어 입력 후 영상 생성 요청
   - 생성된 슬라이드/오디오 확인
   - Ask AI 기능으로 영상 내용 기반 질의
6. **이상 여부 기록** – 브라우저 콘솔, 터미널 로그를 확인해 크롤러/모델 호출 상태 파악

상기 단계를 순서대로 수행하면 핵심 기능을 10~15분 내 검증할 수 있습니다.

---

## 시스템 요구 사항

- **Node.js 20+**
- **npm** (또는 pnpm/bun 가능)
- **OpenAI API Key** (GPT-4o 사용)
- **Puppeteer 실행 가능 OS**
  - macOS / Linux x86_64 기준 테스트
  - Linux에서는 `libnss3`, `libx11`, `libatk-1.0-0`, `fonts-liberation` 등 기본 패키지가 설치되어 있어야 Chromium이 구동됩니다.

---

## 설치 및 초기 세팅

1. 저장소 클론 후 패키지 설치
   ```bash
   npm install
   ```
2. 환경 변수 파일 생성
   - `.env`
     ```ini
     DATABASE_URL="file:./dev.db"
     ```
     Prisma가 SQLite 파일 위치를 인식하는 데 사용합니다.
   - `.env.local`
     ```ini
     OPENAI_API_KEY=sk-...
     ```
     서버 라우트(`src/lib/openai.ts`, `src/app/api/ask/route.ts`)에서 직접 참조합니다. `.env.example`을 복사하면 키 이름을 쉽게 맞출 수 있습니다.
3. 데이터베이스 준비
   ```bash
   npx prisma db push   # Prisma 스키마 반영 및 dev.db 생성
   npx prisma db seed   # (선택) 기본 사용자 swify_user 생성
   ```

---

## 평가용 체험 시나리오

1. **콘텐츠 생성**
   - 개발 서버(`npm run dev`) 실행 후 메인 페이지에서 관심 주제를 입력합니다.
   - 백엔드는 DuckDuckGo HTML 검색 → 상위 결과 요약 → OpenAI GPT 호출 순으로 진행합니다. 터미널에 `[Deep Search]` 로그가 찍히면 정상 동작입니다.
   - 생성이 완료되면 8~12장의 슬라이드, 이미지, 오디오 링크가 표시됩니다.
2. **질문/답변 기능**
   - 영상 미리보기 아래 Ask AI 입력창에 질문을 작성합니다.
   - `/api/ask` 라우트가 GPT로 응답을 생성하며, 2~3문장 이내 답변을 반환하면 성공입니다.
3. **데이터 저장 확인 (선택)**
   - `npx prisma studio`를 실행해 `SavedVideo`, `WatchHistory` 등을 조회하면 dev.db에 자료가 누적되는지 확인할 수 있습니다.
4. **로그 모니터링**
   - Puppeteer가 처음 실행되면 Chromium 다운로드가 자동으로 진행됩니다. `Downloading Chromium` 로그 이후에도 브라우저가 뜨지 않으면 네트워크 혹은 sandbox 문제를 확인해야 합니다.

---

## 자주 발생하는 이슈 & 해결법

| 증상                                 | 원인                            | 해결 방법                                                                                 |
| ------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY is required` 에러    | `.env.local` 미설정             | `.env.local`에 키 추가 후 서버 재실행                                                     |
| `DATABASE_URL` 관련 Prisma 에러      | `.env` 누락 또는 경로 권한 문제 | `.env` 생성 후 `npx prisma db push` 다시 실행                                             |
| Puppeteer `Failed to launch browser` | Linux에서 의존 패키지 부족      | `sudo apt-get install -y libnss3 libxss1 libgtk-3-0 libx11-xcb1 fonts-liberation` 등 설치 |
| DuckDuckGo 검색 실패                 | 네트워크 차단                   | 프록시 사용 또는 `scrapeWeb` 함수의 검색 URL을 다른 엔진으로 변경                         |

---

## NPM 스크립트

| 명령어          | 설명              |
| --------------- | ----------------- |
| `npm run dev`   | Next.js 개발 서버 |
| `npm run build` | 프로덕션 빌드     |
| `npm run start` | 빌드 결과 실행    |
| `npm run lint`  | ESLint 검사       |

필요 시 `npm run build && npm run start`로 프로덕션 모드에서도 동일 절차를 검증할 수 있습니다.

---

## 배포 참고 사항

- `.env*`는 gitignore 대상이므로, 실제 배포 환경에서는 `DATABASE_URL`과 `OPENAI_API_KEY`를 각각의 플랫폼 환경 변수로 지정해 주십시오.
- Puppeteer는 서버리스 환경에서 제약이 많습니다. 장기적으로는 Playwright + 외부 브라우저 서비스 또는 검색 API로 교체하는 방향을 고려하고 있습니다.
- SQLite는 단일 인스턴스 기준입니다. 멀티 인스턴스 배포가 필요하면 PostgreSQL 등으로 마이그레이션 후 `DATABASE_URL`을 새 커넥션 문자열로 변경해 주세요.
