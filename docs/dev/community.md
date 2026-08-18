# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 갤러리 목록 화면(탭 2개: 전체/나의 종족), 상세 오버레이, 좋아요 토글, 댓글 작성, 친밀도 지급 헬퍼
- 진행 중: 없음
- 미착수: 글쓰기 모달 + API(LLM 주제 추천 3가지 이상), 본인 글·댓글 삭제, 챗봇

## 구현한 파일
- `app/community/page.tsx` — 목록 화면. 서버 컴포넌트, `searchParams`의 `tab`으로 갤러리 결정
- `app/community/_lib/gallery.ts` — `GalleryTab`("ALL" | TypeCode), `resolveGallery()`, `canAccessGallery()`, `listGalleryPosts()`. "ALL" 관련 로직을 전부 여기 모음
- `app/community/_components/GalleryTabs.tsx` — 탭 2개(전체 커뮤니티 / 나의 종족). 종족 탭은 진단 완료 유저에게만 노출
- `app/community/_components/PostCard.tsx` — 카드 그리드용 게시글 카드. 종족 배지는 전체 탭에서만 노출
- `app/community/_lib/format.ts` — `timeAgo()` 상대 시각 표기 (디자인 시안의 타임어고 방식으로 교체, 절대 날짜 포맷은 폐기)
- `app/api/community/posts/route.ts` — GET. 목록 화면과 동일한 `gallery.ts` 헬퍼를 공유해 로직 중복 없음
- `app/community/_lib/affinity.ts` — 친밀도 지급의 유일한 경로. `grantAffinity(user, base)` 하나로 통일(글/댓글/챗봇 전용 래퍼를 따로 만들지 않음). **챗봇 세션에서도 이 함수를 그대로 재사용할 것** — `COMMENT_AFFINITY`처럼 `CHAT_TURN_AFFINITY` 상수도 이미 정의돼 있음
- `app/community/_components/PostDetailModal.tsx` — 상세 오버레이(클라이언트). 마운트 시 GET으로 상세 로드, 좋아요 토글, 댓글 작성. 배경 클릭으로 닫힘
- `app/community/_components/PostList.tsx` — **지시된 파일 목록엔 없었지만 추가함.** `page.tsx`는 서버 컴포넌트라 `useState`를 못 쓰는데 "목록 페이지에서 selectedPostId를 useState로 든다"는 요구를 만족하려면 클라이언트 경계가 하나 필요해서 분리. `PostCard` 클릭 시 이 컴포넌트가 `selectedPostId`를 들고 `PostDetailModal`을 띄움
- `app/api/community/posts/[id]/route.ts` — GET. 상세 + 댓글 목록 + `likedByMe`
- `app/api/community/posts/[id]/like/route.ts` — POST. `PostLike` 토글 + `Post.likeCount`를 `$transaction`으로 함께 갱신. `@@unique([postId, userId])` 충돌(P2002)은 동시 클릭으로 보고 현재 값을 그대로 반환
- `app/api/community/posts/[id]/comments/route.ts` — POST. `Comment` 생성 + `Post.commentCount` 증가를 `$transaction`으로 묶고, 성공 후에만 `grantAffinity` 호출. 응답에 `granted` 포함

## 수정한 파일
- `app/community/_components/PostCard.tsx` — 카드를 `<button onClick>`으로 바꿔 클릭 시 상세를 열도록 함
- `app/community/page.tsx` — 게시글 그리드 렌더링을 `PostCard` 직접 매핑에서 `PostList`로 교체

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
- 상세 오버레이는 Intercepting Routes 없이 클라이언트 상태(`selectedPostId`)로 구현. URL은 안 바뀜(지시 그대로)
- 친밀도 지급 순서를 반드시 지킴: 날짜 리셋(로컬 계산, DB는 아직 안 건드림) → `calculateReward()`로 배율 적용 → `capAffinity()`로 상한 적용 → `granted > 0`일 때만 `User.affinity`/`affinityToday`/`affinityTodayDate`를 한 번에 갱신. 순서를 바꾸면 상한 100을 넘음
- 좋아요는 친밀도 지급 대상이 아님(SPEC.md 8절에 명시)
- 좋아요·댓글 API의 종족 갤러리 접근 차단은 지난 세션의 `canAccessGallery()`를 그대로 재사용(새로 안 만듦)

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- 글쓰기 모달 + API, LLM 주제 추천 3가지 이상 (친밀도 20은 `grantAffinity(user, POST_AFFINITY)`로 지급)
- 본인 글·댓글 삭제
- 챗봇 화면 + Bedrock 스트리밍 응답, 1턴당 `grantAffinity(user, CHAT_TURN_AFFINITY)` 호출
