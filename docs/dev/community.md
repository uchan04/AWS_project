# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 재개 지점

D 쪽 기능 구현은 끝났고, 지금은 `completeMission()`(B) 외부 결과를 기다리는 대기 상태다. AWS 계정·`BEDROCK_MODEL_ID`는 확보되어 챗봇 스트리밍은 완료했다(2026-08-19). origin/main을 머지해 인프라 완료분(Cognito 실검증, `BottomNav`, RDS 마이그레이션 등)도 받았다(2026-08-19). 아래 6개가 남은 막힌 항목이다. 재개할 때 이 표부터 본다.

### 1. Bedrock 스트리밍 응답 — 완료 (2026-08-19)
`POST /api/chat/stream`을 새로 만들어 `ConverseStreamCommand`로 응답을 스트리밍하고, 스트림이 `messageStop`까지 정상 종료된 경우에만 `ChatRole.ASSISTANT`로 저장한다. 기존 `app/api/chat/messages/route.ts`(사용자 발화 저장 + 친밀도 지급)는 건드리지 않았다. 자세한 내용은 아래 "구현한 파일"·"결정한 것과 이유" 참고.

### 2. `app/layout.tsx` 전역 마운트 — 아직 안 됨 (정정, 2026-08-19)
- **정정**: main 머지로 `app/layout.tsx`에 `<BottomNav />`가 추가된 걸 확인했다. `BottomNav`의 "챗봇" 탭은 `<Link href="/chat">`로 **일반 라우트 이동**만 한다 — `ChatPanel`을 전역 오버레이로 띄우는 상태 토글은 아직 없다. D의 임시 라우트(`app/chat/page.tsx`)가 그대로 이동 목적지가 된 것뿐이라, 이 항목은 **완료가 아니다.** 아래 내용은 여전히 유효하다
- **필요한 것**: E가 `layout.tsx`에 `ChatPanel`을 전역 오버레이로 띄울 자리(예: 하단 탭의 챗봇 진입점)를 만들어야 한다. D는 이 파일을 직접 못 고친다(CLAUDE.md 1절)
- **고칠 파일**: `app/layout.tsx`(E). 지금은 `app/chat/page.tsx`가 임시 확인용 라우트로 대신하고 있다
- **조심할 것**: `ChatPanel`은 `nickname`/`typeCode`/`bedrockConfigured`를 props로 받는 구조다 — `layout.tsx`(또는 그 하위 서버 컴포넌트)가 `getCurrentUser()`와 `process.env.BEDROCK_MODEL_ID`를 읽어 그대로 넘겨주면 된다. `onClose`도 실제로 닫히게 연결해야 한다(`app/chat/page.tsx`는 `onClose` 없이 렌더링 중이라 닫기 버튼이 안 보인다). 오버레이로 바뀌면 `ChatPanel`의 `fixed inset-0 z-50` 래퍼가 `BottomNav`의 `z-10`과 겹치는지도 같이 확인할 것(별도 작업, 이번엔 안 건드림)

### 3. `app/chat/` 폴더 소유 확정 — `CLAUDE.md` 2절 표에 없음
- **필요한 것**: 팀 전원 합의로 `CLAUDE.md` 2절의 폴더 소유 표에 `app/chat/` D를 정식으로 추가
- **고칠 파일**: `CLAUDE.md` 2절(전원 합의 필요, D가 직접 못 고침)
- **조심할 것**: `업무분담.md`의 D 항목엔 이미 명시돼 있어 형식적 절차에 가깝지만, 합의 전까지 다른 담당자가 `app/chat/`을 착각해서 건드릴 위험이 있다

### 4. `Post.galleryType`이 `TypeCode`라 전체 갤러리 글쓰기 불가
- **필요한 것**: 스키마 담당(전원 합의)이 `TypeCode` 3종 + 공용(ALL) 개념을 표현할 방법을 정해야 한다(별도 enum 분리 등)
- **고칠 파일**: `prisma/schema.prisma`(전원 합의) 변경 후 `app/community/_lib/gallery.ts`의 `galleryTypeFilter()`와 `canWriteToGallery()` 두 함수만 고치면 된다 — ALL 관련 로직을 전부 이 파일에 모아둔 설계라 나머지(목록 API, 글쓰기 API, `WriteModal`)는 자동으로 맞춰진다
- **조심할 것**: 같은 파일의 `canAccessGallery()`도 접근 제어를 담당하니 같이 재검토할 것

### 5. LLM 글쓰기 주제 추천 (SPEC 8절)
- **필요한 것**: AWS 계정 / `BEDROCK_MODEL_ID`는 확보됐다(2026-08-19). 더 이상 외부 요인에 막혀 있지 않고, 아직 구현하지 않았을 뿐이다 — 2026-08-19 세션(추천 문구 유형별 분리 작업)은 이 항목이 아니다. 다음 D 세션에서 착수
- **고칠 파일**: `app/community/_components/WriteModal.tsx:90`의 TODO 자리
- **조심할 것**: 가짜 추천 문구를 하드코딩하지 말 것. SPEC 8절은 "3가지 이상 추천"을 요구하며 실제 LLM 호출이어야 한다. `app/api/chat/stream/route.ts`의 `ConverseStreamCommand` 호출 패턴을 참고할 것(단, 이건 스트리밍이 필요 없는 단발 호출이라 `ConverseCommand`가 더 맞을 수 있음)

### 6. `completeMission()` — B 작업 중
- **필요한 것**: B가 `completeMission(userId, code)`의 모듈 경로, 반환값(`void` 또는 `{completed, rewardSeeds, rewardAffinity}` 등), 중복 완료 시 동작(`completed: false`로 반환하는지)을 확정해야 한다
- **고칠 파일**: `app/api/community/posts/route.ts:57`과 `app/api/chat/messages/route.ts:53` 두 TODO 블록. 지금은 호출부가 통째로 주석 처리돼 있다 — 확정되면 import를 추가하고 주석만 풀면 된다
- **조심할 것**: 트랜잭션에 넣지 말 것(미션 실패가 글 작성·댓글 저장을 롤백시키면 안 된다). `DAILY_CHAT`은 사용자 발화 저장 시점에만 호출한다(아래 "주의사항" 참고)

### 7. 클라이언트 Authorization 헤더 — 담당 미정, 팀 확인 대기 (신규, 2026-08-19)
- **필요한 것**: 로그인 화면·토큰 보관 담당이 아직 정해지지 않았다(E가 유력하지만 확정은 아님). `lib/auth.ts`의 서버 쪽 Cognito 토큰 검증(main 머지로 확인)은 끝났지만, D의 `app/chat/_components/ChatPanel.tsx`와 커뮤니티 쪽 `fetch` 호출 어디도 `Authorization: Bearer <token>` 헤더를 붙이지 않는다
- **고칠 파일**: 미정 — 로그인 흐름·토큰 저장 방식(어디 담당, 어떤 스토리지)이 먼저 정해져야 D 쪽 fetch 호출부를 고칠 수 있다
- **조심할 것**: `DEV_AUTH_BYPASS=true`인 로컬 개발에서는 증상이 안 보인다. 이 상태로 배포하면 토큰이 없어 전 API가 401이 된다

### 주의사항 — 재개할 때 잊으면 버그가 된다
- **친밀도 이중 지급**: 챗봇 친밀도(`grantAffinity(user, CHAT_TURN_AFFINITY)`)는 사용자 발화를 저장하는 시점(`app/api/chat/messages/route.ts`)에만 지급한다. Bedrock 응답을 저장하는 로직을 붙일 때 그 자리에서 또 지급하면 중복이다
- **미션 완료도 같은 함정**: `DAILY_CHAT` 미션 완료(`completeMission`)도 사용자 발화 저장 시점에만 호출한다. Bedrock 응답 저장 자리에서 또 부르면 중복이다

---

## 현재 상태
- 완료: 갤러리 목록 화면, 상세 오버레이, 좋아요 토글, 댓글 작성, 글쓰기 모달, 본인 글 삭제, 본인 댓글 삭제, 친밀도 지급 헬퍼, 챗봇 시스템 프롬프트, 챗봇 메시지 저장 API(GET/POST, 친밀도 지급까지), 챗봇 패널 UI(개발용 `/chat` 라우트), Bedrock 스트리밍 응답 연결(`POST /api/chat/stream`), 타이핑 인디케이터, **유형별 챗봇 추천 문구 6개씩·3개 랜덤 노출(LLM 아님, 정적 상수)**
- 진행 중: 없음
- 미착수: LLM 주제 추천 실제 연동, 이미지 업로드, `ChatPanel`을 `layout.tsx`의 전역 오버레이로 이전(E 대기)
- 보류(다음 세션 이전 필요 조건): 전체 탭 글쓰기(스키마에 ALL 값 없음), LLM 주제 추천(SPEC 8절, 이번 세션 범위 아님), 글쓰기 시 일일 미션(`DAILY_COMMUNITY_POST`) 완료 처리(B와 협의 필요), `ChatPanel`의 `layout.tsx` 이전(E 소유 파일이라 D가 직접 못 건드림) — 전부 아래 "결정한 것과 이유"에 근거 남김

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
- `app/api/community/posts/[id]/comments/[commentId]/route.ts` — DELETE. 본인 댓글 소프트 삭제. `Comment.deletedAt` 설정 + `Post.commentCount` 감소를 `$transaction`으로 묶음(댓글 작성의 create + increment와 대칭). 소유자 검사 앞에 `comment.postId !== id`를 먼저 확인한다

- `app/community/_components/WriteModal.tsx` — 글쓰기 버튼 + 모달을 한 컴포넌트로 통합(트리거가 이번 세션에 새로 생기는 것이라 지시된 파일 목록에도 이 컴포넌트만 있고 별도 트리거 컴포넌트는 없었음). `gallery` prop이 `"ALL"`이면 버튼을 비활성화하고 "전체 커뮤니티 글쓰기는 준비 중이에요" 안내만 노출, 종족 갤러리일 때만 모달이 동작. `_lib/gallery.ts`의 `canWriteToGallery()`로 판단(클라이언트 쪽은 UX용 차단이고, 실제 차단은 서버가 함)

## 수정한 파일
- `app/community/_lib/gallery.ts` — `canWriteToGallery(gallery): gallery is TypeCode` 추가. 전체 탭 글쓰기 차단 로직을 여기 한 곳에 모음(스키마에 ALL이 생기면 이 함수만 고치면 됨)
- `app/community/_components/PostCard.tsx` — 카드를 `<button onClick>`으로 바꿔 클릭 시 상세를 열도록 함
- `app/community/_components/PostList.tsx` — 삭제 완료(`onDeleted`) 시 모달을 닫고 `useRouter().refresh()`로 서버 컴포넌트 데이터를 다시 가져와 목록을 갱신
- `app/community/_components/PostDetailModal.tsx` — `isOwn`일 때만 "삭제" 버튼 노출, 삭제 성공 시 `onDeleted` 콜백 호출
- `app/community/page.tsx` — 헤더에 `WriteModal` 배치(전체/종족 탭 공통, 내부에서 분기)
- `app/api/community/posts/route.ts` — POST 추가(글쓰기)
- `app/api/community/posts/[id]/route.ts` — DELETE 추가(본인 글 소프트 삭제), GET 응답에 `isOwn` 추가. GET의 `comments`도 prisma 결과 그대로 내리지 않고 `{ id, body, createdAt, user, isOwn }`으로 매핑(`userId`·`postId`·`deletedAt` 미노출)
- `app/api/community/posts/[id]/comments/route.ts` — POST 응답의 `comment`를 GET 상세와 같은 형태(`{ id, body, createdAt, user, isOwn: true }`)로 매핑. 트랜잭션·`grantAffinity`·`COMMENT_AFFINITY` 로직은 그대로 둠
- `app/community/_components/PostDetailModal.tsx` — `DetailComment`에 `isOwn` 추가, `deletingCommentId` state와 `handleDeleteComment()` 추가. 본인 댓글에만 작은 삭제 버튼(`text-[11px]`, 헤더의 글 삭제 버튼과 같은 계열) 노출

- `app/chat/_lib/systemPrompt.ts` — 챗봇 "마음 친구" 시스템 프롬프트. 공통 원칙(조언·해결책·진단·평가 금지, 유형명 노출 금지, 자해·죽음 언급 시 안전 예외) + 유형별 페르소나 레이어. `buildSystemPrompt(typeCode, nickname)`을 `app/api/chat/messages/route.ts`와 `app/api/chat/stream/route.ts`가 참조
- `app/chat/_lib/starters.ts` — **이번 세션에 추가.** `CHAT_STARTERS: Record<TypeCode, string[]>`. 빈 화면 추천 문구를 유형별 6개씩 정적 상수로 둔다. `TypeCode`는 `@prisma/client`에서 그대로 import(새로 정의하지 않음). LLM 호출 없음
- `app/api/chat/messages/route.ts` — GET(대화 이력 조회, 최근 50개, `createdAt asc`, 이제 `affinityToday`도 응답에 포함) + POST(사용자 메시지 저장 + 친밀도 지급). 진단 전(`typeCode` 없음)이면 400 `NO_TYPE_CODE`
- `app/api/chat/stream/route.ts` — **이번 세션에 추가.** POST. 사용자 메시지 저장 이후 클라이언트가 이어서 호출한다. 최근 20개 대화 이력을 Converse 형식으로 변환해 `ConverseStreamCommand`로 호출하고, 토큰을 `text/plain` 스트림으로 그대로 흘린다. 스트림이 `messageStop`까지 정상 종료됐고 내용이 비어있지 않을 때만 `ChatRole.ASSISTANT`로 저장한다. 메시지 저장·친밀도 지급·미션 완료는 이 라우트에서 하지 않는다(모두 `app/api/chat/messages/route.ts` 소관, 이중 지급 방지). `BEDROCK_MODEL_ID`가 없으면 500 `BEDROCK_NOT_CONFIGURED`로 막는다(클라이언트는 `bedrockConfigured`가 false면 애초에 이 라우트를 호출하지 않는다)
- `app/chat/_components/ChatPanel.tsx` — 우측 460px 슬라이드 패널(클라이언트). 헤더(아바타·진행 바·ℹ 친밀도 안내·✕), 빈 상태(인사말 + 유형별 추천 문구 3개), 메시지 목록(USER 우측 컬러 말풍선 / ASSISTANT 좌측 말풍선), 입력창(Enter 전송·Shift+Enter 줄바꿈). `BEDROCK_MODEL_ID` 없을 때만 개발 모드 배너 노출. `onClose`는 선택 prop — 없으면 ✕·배경 클릭 닫기를 렌더링하지 않음. 이전 세션에 사용자 메시지 저장 성공 직후 `streamAssistantReply()`를 호출해 `/api/chat/stream`을 스트리밍으로 소비하도록 연결(첫 토큰 전엔 타이핑 인디케이터, 이후엔 텍스트가 자라나는 말풍선, 스트리밍 중 입력창·전송 버튼 비활성화)했다. **이번 세션에 수정**: 하드코딩된 `SUGGESTIONS` 배열을 지우고, `CHAT_STARTERS[typeCode]` 6개 중 3개를 뽑는 `pickThreeStarters()`(Fisher-Yates, 외부 라이브러리 없이 직접 구현)를 추가. 결과는 `useState(() => typeCode ? pickThreeStarters(typeCode) : [])` 초기화 함수 안에서 한 번만 계산해 `starters` state로 보관 — 리렌더마다 다시 섞이지 않고, 컴포넌트가 새로 마운트될 때(패널 재진입)만 새로 뽑힌다
- `app/chat/page.tsx` — 개발 확인용 라우트. 서버 컴포넌트에서 `getCurrentUser()`로 `nickname`/`typeCode`를, `process.env.BEDROCK_MODEL_ID`로 `bedrockConfigured`를 읽어 `ChatPanel`에 props로 넘김. `onClose` 없이 렌더링. `export const dynamic = "force-dynamic"` 필수(아래 이유 참고)

**`app/chat/` 폴더 소유 — 팀 확인 대기.** `CLAUDE.md` 2절의 폴더 소유 표(`app/diagnosis/` A, `app/missions/` B, `app/pet/` C, `app/community/` D, `app/(auth)/` E)에는 `app/chat/`이 없다. `업무분담.md`의 D 항목에 "AI 상담 챗봇"과 `/api/chat/*`가 D 담당으로 명시돼 있어 D 소유로 보고 진행했지만, `CLAUDE.md` 갱신은 전원 합의가 필요하므로 다음 통합 때 팀에 확인해 `CLAUDE.md` 2절에 정식으로 추가해야 한다.

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
- **댓글 삭제도 친밀도를 회수하지 않는다.** 글 삭제와 같은 이유다 — `affinityToday`가 이미 누적돼 있어 지웠다 다시 써도 하루 상한 100을 넘길 수 없다. `grantAffinity`·`calculateReward`를 아예 부르지 않으므로 댓글 DELETE는 `getCurrentUserWithSkin()`이 아니라 `getCurrentUser()`를 쓴다(`activePetSkin`이 필요 없음)
- **댓글 DELETE는 트랜잭션 전에 `deletedAt`을 먼저 검사한다.** 이 검사를 빼면 이미 삭제된 댓글에 DELETE를 한 번 더 보낼 때 `commentCount`가 계속 감소해 음수가 된다. 같은 이유로 `comment.postId !== id`(URL의 글과 댓글 불일치)도 먼저 막는다 — 그냥 진행하면 엉뚱한 글의 `commentCount`를 깎는다
- **댓글 DELETE에 `canAccessGallery()` 검사는 넣지 않는다.** 본인 댓글이라는 조건이 갤러리 접근 권한보다 강하고, 글 DELETE도 소유자 검사만 한다 — 두 라우트의 구조를 맞췄다
- **댓글 응답에서 `userId`를 `isOwn`으로 바꿨다.** 기존 GET은 prisma 결과를 그대로 내려 `userId`가 클라이언트에 노출됐다. 글(`post`)이 이미 `isOwn`을 쓰고 있어 형태를 통일했다. POST(댓글 작성) 응답도 같이 맞췄다 — 작성 직후 돌아온 댓글이 목록에 바로 붙는 구조라, 안 맞추면 방금 쓴 댓글에만 삭제 버튼이 안 보이고 새로고침해야 생기는 버그가 된다
- **삭제 진행 상태는 `deletingCommentId: string | null`로 든다.** 단일 boolean을 쓰면 한 댓글을 지우는 동안 다른 댓글의 삭제 버튼까지 전부 비활성화된다
- **댓글 삭제에 `window.confirm`을 쓰지 않는다.** 글 삭제도 확인창 없이 바로 지운다 — 패턴을 맞췄다
- 글쓰기 API는 `galleryType`을 요청 바디로 받되, `canAccessGallery(galleryType, user.typeCode)`로 본인 종족과 다르면 차단 → `canWriteToGallery(galleryType)`로 `ALL`을 차단하는 순서로 검증(먼저 소속 확인, 그다음 쓰기 가능 여부)
- 삭제 후 화면 갱신은 페이지 새로고침이 아니라 `next/navigation`의 `useRouter().refresh()`로 처리. 서버 컴포넌트(`page.tsx`)의 데이터만 다시 가져오고 모달이 닫히는 클라이언트 상태는 유지됨
- **(지난 세션) 챗봇 메시지 API는 실제 Bedrock 호출 없이 "사용자 메시지 저장" 부분만 완성했었다.** 이번 세션에 AWS 계정·`BEDROCK_MODEL_ID`가 확보되어 실제 연결을 완료했다(아래 항목들).
- **Bedrock 호출을 별도 라우트(`POST /api/chat/stream`)로 분리했다.** `app/api/chat/messages/route.ts`(사용자 발화 저장 + 친밀도 지급)는 건드리지 않는다는 지시를 그대로 지키기 위함. 클라이언트가 메시지 저장 성공 후 이어서 스트림 라우트를 호출하는 2단계 흐름이다 — 한 라우트에서 저장과 생성을 모두 하지 않는다
- **대화 이력은 최근 20개만 Bedrock에 보낸다.** GET `/api/chat/messages`의 50개(화면 표시용)와는 별개 상수(`HISTORY_LIMIT`)다. 매 요청마다 전체 대화를 보내면 토큰 비용이 계속 누적된다는 지시에 따름
- **스트림은 `messageStop` 이벤트까지 정상 수신되고 내용이 비어있지 않을 때만 저장한다.** 클라이언트 fetch가 중간에 끊기거나(reader 루프 도중 예외) Bedrock 쪽 스트림이 에러로 끝나면 `completed`가 `true`가 되지 않아 저장을 건너뛴다 — 잘린 문장이 다음 대화 이력에 섞이는 것을 막기 위함(지시 그대로)
- **클라이언트도 같은 조건으로 화면에 반영한다.** `reader.read()` 루프가 끝난 뒤 누적 텍스트가 있을 때만 `messages`에 추가한다. 서버가 저장을 거부한 상황(스트림 중단)에서 화면에만 메시지가 남는 불일치를 막기 위함
- **스트리밍 중에는 입력창·전송 버튼을 비활성화한다.** 응답이 오는 도중 사용자가 새 메시지를 보내면 두 번째 스트림 요청이 아직 저장되지 않은 이전 대화 상태를 이력으로 읽어갈 수 있어 순서를 보장하기 위해 막았다
- **친밀도 지급 시점 판단: "1턴"을 사용자가 메시지를 보낸 시점으로 본다.** Bedrock 응답이 아직 없으므로 사용자 발화 저장 직후 `grantAffinity(user, CHAT_TURN_AFFINITY)`를 호출한다. **주의: 나중에 Bedrock 어시스턴트 응답 저장 로직을 추가할 때 그 자리에서 다시 지급하면 안 된다** — 지급은 이 POST 핸들러 한 곳에서만 일어나야 한다(이중 지급 방지)
- 챗봇도 진단(`typeCode`)이 있어야 페르소나를 만들 수 있어서, 진단 전 유저가 메시지를 보내면 400 `NO_TYPE_CODE`로 막는다(처음엔 `DIAGNOSIS_REQUIRED`였다가 이후 지시로 `NO_TYPE_CODE`로 통일)
- GET 대화 이력은 최근 50개로 제한한다. `orderBy: asc, take: 50`이 아니라 `orderBy: desc, take: 50` 후 배열을 뒤집는 방식을 쓴다 — asc로 그냥 자르면 대화가 길어졌을 때 항상 가장 오래된 50개만 보여서 최근 대화가 안 보이는 버그가 됨
- `app/chat/_lib/systemPrompt.ts` 파일명은 이전 세션 결정(`persona.ts`에서 `systemPrompt.ts`로 변경, 유지하라는 명시적 지시)을 그대로 따른다. 이후 세션에서 다시 `persona.ts`로 만들라는 요청이 있었지만 이미 커밋된 파일이라 이름을 그대로 두고 내용만 이번 지시에 맞춰 갱신했다
- **`ChatPanel`은 `nickname`/`typeCode`/`bedrockConfigured`를 props로 받는다(자체 fetch 아님).** GET `/api/chat/messages`는 메시지·`affinityToday`만 준다 — 이번 세션에 그 이상 확장하라는 지시가 없었다. 대신 `app/chat/page.tsx`(서버 컴포넌트)가 `getCurrentUser()`와 `process.env.BEDROCK_MODEL_ID`를 직접 읽어 props로 넘긴다. `layout.tsx`가 전역 오버레이로 `ChatPanel`을 렌더링하게 될 때도 그 부모(서버 컴포넌트)가 같은 방식으로 props를 넘겨주면 된다
- **`app/chat/page.tsx`에 `export const dynamic = "force-dynamic"`을 반드시 넣는다.** `searchParams` 같은 동적 신호가 없는 서버 컴포넌트라 그냥 두면 Next가 빌드 시점에 정적 페이지로 캐시해버린다(빌드 시점의 dev 유저 스냅샷이 그대로 굳어 이후 요청에도 재사용됨). 실제로 처음 빌드에서 `/chat`이 `○`(Static)로 잡히는 걸 확인하고 고쳤다. `app/community/page.tsx`는 `searchParams`를 읽어서 저절로 동적이 되므로 이 설정이 필요 없었던 것과 대비됨
- **개발 모드 배너는 서버에서 계산한 `bedrockConfigured`(boolean)로 제어한다.** `BEDROCK_MODEL_ID`는 `NEXT_PUBLIC_` 접두사가 없는 서버 전용 env라 클라이언트 컴포넌트(`ChatPanel`)에서 직접 `process.env.BEDROCK_MODEL_ID`를 읽으면 항상 `undefined`로 인라인된다. 그래서 서버 컴포넌트에서 읽어 boolean만 prop으로 내려준다 — "값이 채워지면 배너가 자동으로 사라지는" 요구를 만족하려면 이 방법뿐이다
- 친밀도 진행 바 갱신은 `setAffinityToday(prev => prev + granted)`만 쓴다. `granted`는 서버가 이미 상한을 적용해 계산한 값이라 `prev + granted`는 수학적으로 100을 넘을 수 없다 — 클라이언트에서 별도로 `Math.min(100, ...)`을 계산하지 않는다(지시 그대로)
- 추천 문구 클릭은 바로 전송하지 않고 입력창을 채우기만 한다. 오탈자·오클릭으로 원치 않는 메시지가 바로 나가는 걸 막기 위함(전송 여부는 사용자가 최종 확인)
- **(지난 세션) 타이핑 인디케이터는 만들지 않았었다.** Bedrock 미연결 상태에서 점 3개가 계속 도는 게 더 혼란스럽다는 지시대로였다. 이번 세션에 Bedrock 연결과 함께 추가했다 — 첫 토큰이 오기 전까지만 점 3개(`animate-bounce`, `globals.css` 수정 없이 Tailwind 기본 클래스 + 인라인 `animationDelay`만 사용), 토큰이 오면 그 자리에서 텍스트로 교체된다
- **(지난 세션) 빈 화면 추천 문구는 하드코딩된 3개 배열(`SUGGESTIONS`)로 모든 유형에 동일하게 노출했었다.** 이번 세션에 유형별 6개씩(`app/chat/_lib/starters.ts`의 `CHAT_STARTERS`)으로 분리하고 그중 3개를 무작위로 보여주도록 바꿨다. LLM을 쓰지 않는다 — 정적 상수일 뿐이며, 문구 텍스트는 지시받은 그대로 넣었다(임의로 다듬지 않음)
- **랜덤 선택은 `useState`의 초기화 함수 안에서 한 번만 실행한다.** `useState(() => typeCode ? pickThreeStarters(typeCode) : [])` — 서버에서 미리 섞으면 SSR HTML과 클라이언트 hydration 렌더가 다른 조합을 계산해 hydration 불일치 경고가 난다. 다만 이 값이 실제로 화면에 노출되는 시점은 `loading`이 `false`가 된 뒤(GET `/api/chat/messages` 완료 후)라 SSR 시점엔 애초에 렌더되지 않는 분기(`loading ? ... : ...`) 뒤에 가려져 있고, hydration 비교 대상도 아니다. `useEffect`로 재추첨하지 않는다 — 그러면 리렌더마다 값이 또 바뀔 위험이 있고, 컴포넌트가 마운트될 때(패널을 닫았다 다시 열 때) 한 번만 뽑히는 요구를 깨뜨린다
- **셔플은 Fisher-Yates를 직접 구현했다.** lodash 같은 새 라이브러리를 추가하지 않는다는 지시에 따름(`package.json`에 이미 있는 것만 사용)
- **`typeCode`가 `null`이면 `starters`도 빈 배열(`[]`)이 된다.** 렌더 쪽의 `{typeCode && (...)}` 가드는 그대로 유지했다 — 이미 있던 "진단 미완료 안내" 동작을 건드리지 않기 위해 이중으로 막아둔 것이지 새로 만든 로직은 아니다

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- LLM 주제 추천 3가지 이상 연동 — `BEDROCK_MODEL_ID` 확보됐으니 `WriteModal`의 TODO 자리에 구현 가능. `app/api/chat/stream/route.ts`의 `ConverseStreamCommand` 호출 패턴을 참고할 것(단, 이건 비스트리밍 단발 호출이라 `ConverseCommand`가 더 맞을 수 있음)
- 전체 탭 글쓰기 — 스키마에 ALL(또는 공용 게시판) 개념이 추가되면 `_lib/gallery.ts`의 `canWriteToGallery()`만 고치면 됨
- `DAILY_COMMUNITY_POST` 일일 미션 완료 처리 — B와 담당 경계 협의 필요
- **`ChatPanel`을 `app/chat/page.tsx`(개발용)에서 `layout.tsx`의 전역 오버레이로 이전 — E와 조율 필요.** `layout.tsx`는 E 소유라 D가 직접 못 고친다. 이전할 때 `nickname`/`typeCode`/`bedrockConfigured` props를 넘기는 방식과 `onClose` 연결(전역에서는 실제로 닫을 수 있어야 함)을 그대로 유지할 것
- `app/chat/` 폴더 소유를 `CLAUDE.md` 2절에 정식 반영 — 팀 확인 대기 (계속 남아있는 이월 항목)
