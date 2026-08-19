# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 갤러리 목록 화면, 상세 오버레이, 좋아요 토글, 댓글 작성, 글쓰기 모달, 본인 글 삭제, 친밀도 지급 헬퍼, 챗봇 시스템 프롬프트, 챗봇 메시지 저장 API(GET/POST, 친밀도 지급까지)
- 진행 중: 없음
- 미착수: 본인 댓글 삭제, 챗봇 화면(UI), Bedrock 실제 호출·스트리밍, LLM 주제 추천 실제 연동, 이미지 업로드
- 보류(다음 세션 이전 필요 조건): 전체 탭 글쓰기(스키마에 ALL 값 없음), LLM 주제 추천(`BEDROCK_MODEL_ID` 없음), Bedrock 챗봇 응답 생성(`BEDROCK_MODEL_ID` 없음), 글쓰기 시 일일 미션(`DAILY_COMMUNITY_POST`) 완료 처리(B와 협의 필요) — 전부 아래 "결정한 것과 이유"에 근거 남김

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

- `app/community/_components/WriteModal.tsx` — 글쓰기 버튼 + 모달을 한 컴포넌트로 통합(트리거가 이번 세션에 새로 생기는 것이라 지시된 파일 목록에도 이 컴포넌트만 있고 별도 트리거 컴포넌트는 없었음). `gallery` prop이 `"ALL"`이면 버튼을 비활성화하고 "전체 커뮤니티 글쓰기는 준비 중이에요" 안내만 노출, 종족 갤러리일 때만 모달이 동작. `_lib/gallery.ts`의 `canWriteToGallery()`로 판단(클라이언트 쪽은 UX용 차단이고, 실제 차단은 서버가 함)

## 수정한 파일
- `app/community/_lib/gallery.ts` — `canWriteToGallery(gallery): gallery is TypeCode` 추가. 전체 탭 글쓰기 차단 로직을 여기 한 곳에 모음(스키마에 ALL이 생기면 이 함수만 고치면 됨)
- `app/community/_components/PostCard.tsx` — 카드를 `<button onClick>`으로 바꿔 클릭 시 상세를 열도록 함
- `app/community/_components/PostList.tsx` — 삭제 완료(`onDeleted`) 시 모달을 닫고 `useRouter().refresh()`로 서버 컴포넌트 데이터를 다시 가져와 목록을 갱신
- `app/community/_components/PostDetailModal.tsx` — `isOwn`일 때만 "삭제" 버튼 노출, 삭제 성공 시 `onDeleted` 콜백 호출
- `app/community/page.tsx` — 헤더에 `WriteModal` 배치(전체/종족 탭 공통, 내부에서 분기)
- `app/api/community/posts/route.ts` — POST 추가(글쓰기)
- `app/api/community/posts/[id]/route.ts` — DELETE 추가(본인 글 소프트 삭제), GET 응답에 `isOwn` 추가

- `app/chat/_lib/systemPrompt.ts` — 챗봇 "마음 친구" 시스템 프롬프트. 공통 원칙(조언·해결책·진단·평가 금지, 유형명 노출 금지, 자해·죽음 언급 시 안전 예외) + 유형별 페르소나 레이어. `buildSystemPrompt(typeCode, nickname)`을 `app/api/chat/messages/route.ts`가 참조
- `app/api/chat/messages/route.ts` — GET(대화 이력 조회, `createdAt asc`) + POST(사용자 메시지 저장 + 친밀도 지급). 진단 전(`typeCode` 없음)이면 400 `DIAGNOSIS_REQUIRED`

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
- **전체 탭 글쓰기는 보류.** `Post.galleryType`이 `TypeCode` enum이라 `ALL` 값을 저장할 수 없음. 클라이언트(`WriteModal`)와 서버(POST 라우트) 양쪽에서 `canWriteToGallery()`로 막음 — 버튼만 비활성화하면 API 직접 호출로 뚫리기 때문에 서버 차단이 필수
- **LLM 주제 추천은 보류.** `BEDROCK_MODEL_ID`가 비어 있어 구현 불가. `WriteModal`에 비활성 영역만 두고 `// TODO: Bedrock 주제 추천 — BEDROCK_MODEL_ID 확보 후 구현 (SPEC 8절)` 주석만 남김. 가짜 추천 문구는 하드코딩하지 않음
- **일일 미션(`DAILY_COMMUNITY_POST`) 완료 처리는 보류.** `UserMission`은 B의 도메인이라 직접 만들지 않음. 작성 API에 `// TODO: DAILY_COMMUNITY_POST 완료 처리 — 담당 B와 협의 중` 주석만 남김
- 삭제는 소프트 삭제(`deletedAt`)이며 친밀도를 회수하지 않는다. `affinityToday`가 이미 누적돼 있어 삭제 후 재작성으로 하루 상한을 넘길 수 없음
- 글쓰기 API는 `galleryType`을 요청 바디로 받되, `canAccessGallery(galleryType, user.typeCode)`로 본인 종족과 다르면 차단 → `canWriteToGallery(galleryType)`로 `ALL`을 차단하는 순서로 검증(먼저 소속 확인, 그다음 쓰기 가능 여부)
- 삭제 후 화면 갱신은 페이지 새로고침이 아니라 `next/navigation`의 `useRouter().refresh()`로 처리. 서버 컴포넌트(`page.tsx`)의 데이터만 다시 가져오고 모달이 닫히는 클라이언트 상태는 유지됨
- **챗봇 메시지 API는 실제 Bedrock 호출 없이 "사용자 메시지 저장" 부분만 이번 세션에 완성.** `POST`가 `buildSystemPrompt()`로 시스템 프롬프트를 실제로 만들어두지만(파일이 아무데도 안 쓰이는 죽은 코드가 되지 않도록), 호출부는 `// TODO: Bedrock 호출...` 주석만 남기고 실제 모델 호출·스트리밍·`ChatRole.ASSISTANT` 저장은 하지 않음. 가짜 어시스턴트 응답을 지어내지 않음(하드코딩 금지 원칙과 동일)
- **친밀도 지급 시점 판단: "1턴"을 사용자가 메시지를 보낸 시점으로 본다.** Bedrock 응답이 아직 없으므로 사용자 발화 저장 직후 `grantAffinity(user, CHAT_TURN_AFFINITY)`를 호출한다. **주의: 나중에 Bedrock 어시스턴트 응답 저장 로직을 추가할 때 그 자리에서 다시 지급하면 안 된다** — 지급은 이 POST 핸들러 한 곳에서만 일어나야 한다(이중 지급 방지)
- 챗봇도 진단(`typeCode`)이 있어야 페르소나를 만들 수 있어서, 진단 전 유저가 메시지를 보내면 400 `DIAGNOSIS_REQUIRED`로 막는다

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- 본인 댓글 삭제
- LLM 주제 추천 3가지 이상 연동 — `BEDROCK_MODEL_ID` 확보되면 `WriteModal`의 TODO 자리에 구현
- 전체 탭 글쓰기 — 스키마에 ALL(또는 공용 게시판) 개념이 추가되면 `_lib/gallery.ts`의 `canWriteToGallery()`만 고치면 됨
- `DAILY_COMMUNITY_POST` 일일 미션 완료 처리 — B와 담당 경계 협의 필요
- 챗봇 화면(UI) — `app/api/chat/messages`의 GET/POST를 그대로 씀
- Bedrock 실제 호출 + 스트리밍 — `BEDROCK_MODEL_ID` 확보되면 `app/api/chat/messages/route.ts`의 TODO 자리에 구현. 친밀도 지급은 이미 그 자리에서 끝났으니 새로 추가하지 말 것
