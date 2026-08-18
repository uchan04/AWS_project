# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 갤러리 목록 화면 (허브 리다이렉트 + 갤러리별 게시글 목록, 최근 20개 고정)
- 진행 중: 없음
- 미착수: 상세, 글쓰기, 댓글, 좋아요, 본인 글·댓글 삭제, LLM 주제 추천, 챗봇, 친밀도 지급

## 구현한 파일
- `app/community/page.tsx` — 진입점. `user.typeCode`가 있으면 본인 갤러리로, 없으면 기본 갤러리로 리다이렉트
- `app/community/[type]/page.tsx` — 갤러리별 게시글 목록. `deletedAt: null`, `createdAt desc`, `take: 20`
- `app/community/_components/GalleryTabs.tsx` — 3갤러리 탭. `TRIBE`의 `colorHex`로 색 구분
- `app/community/_lib/format.ts` — 목록용 날짜 포맷 (`M/d HH:mm`)

## 결정한 것과 이유
- 작성자 표기는 `닉네임 + 종족 배지`. `lib/types.ts`의 `authorLabel()` 사용
- 친밀도는 챗봇 1턴 5 / 글 20 / 댓글 5이고 하루 누계 상한 100을 공유한다. `capAffinity()` 사용
- 챗봇 시스템 프롬프트에 "조언·해결책 제시 금지, 공감과 경청" 명시
- 페이지네이션 없음(최근 20개 고정), 신고·차단 없음
- 갤러리 URL은 `TypeCode` 값을 그대로 슬러그로 쓴다 (`/community/HEALTH_EMOTION`). 별도 슬러그 매핑을 만들지 않기 위함
- 목록은 읽기 전용이라 API 라우트 없이 Server Component에서 prisma를 직접 조회한다. 글쓰기·좋아요·댓글·삭제 같은 변경 작업만 `app/api/community/`에 라우트를 만들 것

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- 게시글 상세 화면 (`/community/[type]/[postId]`)
- 글쓰기 화면 + API, LLM 주제 추천 3가지 이상
- 댓글·좋아요·본인 글삭제 API
- Bedrock 스트리밍 응답 연결 (챗봇)
