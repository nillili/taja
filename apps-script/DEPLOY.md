# Apps Script 배포 가이드

## 1. 스크립트 열기

https://script.google.com 접속 → 새 프로젝트

## 2. Code.gs 붙여넣기

기본 코드를 모두 지우고 `apps-script/Code.gs` 내용을 전체 붙여넣기.

## 3. 배포

1. 상단 메뉴 **배포** → **새 배포**
2. 유형: **웹 앱**
3. 설정:
   - 설명: `타자연습 API v1`
   - 다음 사용자로 실행: **나 (ds1lph@gmail.com)**
   - 액세스 권한: **모든 사용자**
4. **배포** 클릭
5. 나타나는 **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/AKfy.../exec`)

## 4. Cloudflare Pages 환경변수 설정

Cloudflare 대시보드 → Pages → 해당 프로젝트 → **Settings** → **Environment variables**

| 변수명 | 값 |
|---|---|
| `APPS_SCRIPT_URL` | 위에서 복사한 웹 앱 URL |

Production / Preview 둘 다 추가.

배포(재빌드) 후 `/api/words`, `/api/records?board=today` 로 테스트.

## 5. 동작 확인 (브라우저 또는 curl)

```bash
# 낱말 데이터
curl "https://your-pages-domain/api/words?action=words"

# 기록 읽기
curl "https://your-pages-domain/api/records?action=records&board=today"

# 기록 저장 (테스트)
curl -X POST "https://your-pages-domain/api/records" \
  -H "Content-Type: application/json" \
  -d '{"action":"saveRecord","board":"today","school":"테스트초","name":"홍길동","wpm":300,"acc":95}'
```

## 6. 로컬 dev에서 API 연결하기 (선택)

`.env.local` 파일을 프로젝트 루트에 만들고:

```
VITE_API_URL=https://script.google.com/macros/s/AKfy.../exec
```

`npm run dev` 재시작 → `/api/*` 요청이 Apps Script로 직접 연결됨.
