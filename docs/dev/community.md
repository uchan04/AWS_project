# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 갤러리 목록 화면 (팀 디자인 시안 기준으로 재작업 — 탭 2개: 전체/나의 종족), 조회 API
- 진행 중: 없음
- 미착수: 상세, 글쓰기, 댓글, 좋아요, 본인 글·댓글 삭제, LLM 주제 추천, 챗봇, 친밀도 지급

## 구현한 파일
- `app/community/page.tsx` — 목록 화면. 서버 컴포넌트, `searchParams`의 `tab`으로 갤러리 결정
- `app/community/_lib/gallery.ts` — `GalleryTab`("ALL" | TypeCode), `resolveGallery()`, `canAccessGallery()`, `listGalleryPosts()`. "ALL" 관련 로직을 전부 여기 모음
- `app/community/_components/GalleryTabs.tsx` — 탭 2개(전체 커뮤니티 / 나의 종족). 종족 탭은 진단 완료 유저에게만 노출
- `app/community/_components/PostCard.tsx` — 카드 그리드용 게시글 카드. 종족 배지는 전체 탭에서만 노출
- `app/community/_lib/format.ts` — `timeAgo()` 상대 시각 표기 (디자인 시안의 타임어고 방식으로 교체, 절대 날짜 포맷은 폐기)
- `app/api/community/posts/route.ts` — GET. 목록 화면과 동일한 `gallery.ts` 헬퍼를 공유해 로직 중복 없음

## 삭제한 파일
- `app/community/[type]/page.tsx` — URL로 다른 종족 갤러리에 접근 가능했던 예전 동적 라우트. 팀 디자인 시안 반영으로 갤러리 탭이 "전체/나의 종족" 2개로 바뀌면서 제거

## 결정한 것과 이유
- **SPEC.md 8절의 "유형별 갤러리 3개"를 팀 디자인 시안 기준으로 덮어씀**: 갤러리 탭은 2개(전체 커뮤니티 / 나의 종족)다. 종족 갤러리는 본인 종족만 접근 가능. SPEC.md 원문은 안 고침 — 시안이 최신 팀 결정이라는 별도 지시에 따름
- 작성자 표기는 `닉네임 + 종족 배지`. `lib/types.ts`의 `authorLabel()` 사용. 추가로 카드 코너의 색 배지(컬러 필)는 전체 탭에서만 노출(디자인 시안 유지)
- 친밀도는 챗봇 1턴 5 / 글 20 / 댓글 5이고 하루 누계 상한 100을 공유한다. `capAffinity()` 사용
- 챗봇 시스템 프롬프트에 "조언·해결책 제시 금지, 공감과 경청" 명시
- 페이지네이션 없음(최근 20개 고정), 신고·차단 없음
- **API 상태 코드는 CLAUDE.md 7절(`200/400/401/404/500`만)을 그대로 따른다.** 종족 갤러리 접근 차단은 403이 아니라 400 + `code: "FORBIDDEN"`으로 응답
- 색상은 시안의 `CHARACTER_COLOR`를 새로 정의하지 않고 `lib/types.ts`의 `TRIBE[typeCode].colorHex`를 그대로 쓴다. 동적 색상값이라 해당 부분만 Tailwind 대신 인라인 `style`을 씀(나머지 레이아웃·간격은 전부 Tailwind)
- 이미지 업로드(시안의 FileReader base64)는 이번 범위에서 제외. `Post.imageKey`는 S3 키 구조라 다름
- 목록 화면과 GET API가 로직을 중복하지 않도록 `_lib/gallery.ts`의 `listGalleryPosts()`를 공유

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- 게시글 상세 화면 (`/community/[postId]`)
- 글쓰기 화면 + API, LLM 주제 추천 3가지 이상
- 댓글·좋아요·본인 글삭제 API
- Bedrock 스트리밍 응답 연결 (챗봇)
