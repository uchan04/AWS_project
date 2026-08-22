# 커뮤니티·챗봇 개발 문서 (담당 D)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 7·8절, 규칙은 `CLAUDE.md`.

## 재개 지점

D 쪽 기능 구현은 끝났고, 외부 대기 항목도 없다. AWS 계정·`BEDROCK_MODEL_ID`는 확보되어 챗봇 스트리밍은 완료했다(2026-08-19). origin/main을 머지해 인프라 완료분(Cognito 실검증, `BottomNav`, RDS 마이그레이션 등)도 받았다(2026-08-19). 2026-08-20에 `origin/develop`을 두 차례 머지해 A·B·C·E 작업분을 받았고, 챗봇을 전역 오버레이로 이전했다(차단 2 해소). 2026-08-21에 미션 완료 연동(6번)을 처리했고, 같은 날 `origin/develop`을 다시 머지해 흐름 변경분(소개 → 가입/로그인 → 문항 → 결과 → 홈, 자체 DB 계정)을 받았다. 챗봇 버튼 노출 판정은 이 머지에서 **허용 목록 방식으로 대체**됐다 — D의 `HIDDEN_PATHS`는 남아 있지 않다(`docs/STATUS.md` 차단 20번 + 21번의 D 몫 해소). **아래 표에서 남은 항목은 3번(`app/chat/` 폴더 소유 확정, 팀 합의 대기) 하나뿐이다.** 재개할 때 이 표부터 본다.

### 1. Bedrock 스트리밍 응답 — 완료 (2026-08-19)
`POST /api/chat/stream`을 새로 만들어 `ConverseStreamCommand`로 응답을 스트리밍하고, 스트림이 `messageStop`까지 정상 종료된 경우에만 `ChatRole.ASSISTANT`로 저장한다. 기존 `app/api/chat/messages/route.ts`(사용자 발화 저장 + 친밀도 지급)는 건드리지 않았다. 자세한 내용은 아래 "구현한 파일"·"결정한 것과 이유" 참고.

### 2. `app/layout.tsx` 전역 마운트 — 해소 (2026-08-20)
- `app/chat/_components/ChatLauncher.tsx`(신규, 클라이언트)가 열림 상태를 갖고, `app/layout.tsx`는 import 한 줄 + `<ChatLauncher />` 한 줄만 추가했다. E와 사전 공유했고 `layout.tsx` 변경은 **PR 리뷰를 받는다**
- 임시 라우트 `app/chat/page.tsx`는 삭제했다(`/chat`은 이제 404). `app/chat/_components/`·`app/chat/_lib/`·`app/api/chat/`은 그대로다
- `ChatPanel`이 받던 `nickname`/`typeCode`/`bedrockConfigured` props는 없앴다. 자세한 이유는 아래 "결정한 것과 이유" 참고
- 브라우저 확인 완료(2026-08-20): 홈·미션·펫·커뮤니티 네 화면에서 플로팅 버튼 → 패널 열림, ✕ 닫힘, 배경 딤 클릭 닫힘을 실제로 눌러 확인했다. `/diagnosis`에서는 버튼이 안 보인다. 콘솔 에러 0건(React DevTools 안내와 HMR 로그만, 하이드레이션 경고 없음)

### 3. `app/chat/` 폴더 소유 확정 — `CLAUDE.md` 2절 표에 없음
- **필요한 것**: 팀 전원 합의로 `CLAUDE.md` 2절의 폴더 소유 표에 `app/chat/` D를 정식으로 추가
- **고칠 파일**: `CLAUDE.md` 2절(전원 합의 필요, D가 직접 못 고침)
- **조심할 것**: `업무분담.md`의 D 항목엔 이미 명시돼 있어 형식적 절차에 가깝지만, 합의 전까지 다른 담당자가 `app/chat/`을 착각해서 건드릴 위험이 있다

### 4. 전체 탭 글쓰기 — 해소 (2026-08-20)
- E가 `enum GalleryType`(TypeCode 3종 + `ALL`)을 만들고 `Post.galleryType`을 그 타입으로 바꿔 전제 조건이 풀렸다(마이그레이션 `20260820130000_post_gallery_type_all`)
- D 쪽 변경은 3파일뿐이다 — `_lib/gallery.ts`(`GalleryTab = GalleryType`, `canWriteToGallery()`는 항상 true), `app/api/community/posts/route.ts`(400 제거 + enum 검증), `WriteModal.tsx`(중립 색 + 추천 영역 제외). ALL 로직을 `gallery.ts` 한 곳에 모아둔 설계가 실제로 값을 했다
- `galleryTypeFilter()`는 그대로다. 전체 탭은 여전히 필터 없이 ALL 글과 종족 갤러리 글을 함께 보여준다

### 5. 글쓰기 주제 추천 — 고정 문구로 구현 (2026-08-20)
- `app/community/_lib/topics.ts`(유형별 6개, `{ title, draft }`)에서 3개를 랜덤으로 뽑아 `WriteModal`에 카드로 띄운다. 클릭하면 제목·본문이 채워진다
- **SPEC 8절이 명시한 LLM 추천은 아니다.** 일정상 고정 문구로 갔고, 구조는 `topics.ts` 교체만으로 LLM 전환이 되도록 열어뒀다. 근거는 아래 "결정한 것과 이유" 참고
- **발표에서 AI 생성이라고 소개하지 않는다**

### 6. 미션 완료 연동 — 해소 (2026-08-21)
- B가 `lib/missions/completion.ts`에 `completeMissionByCode({ actor, code })`를 확정했다. 주석에 준비해뒀던 `completeMission(userId, code)`와 시그니처가 달라 주석을 푸는 대신 새로 썼다
- 두 라우트가 이미 `getCurrentUserWithSkin()`을 쓰고 있어 `user`가 `ActorWithSkin`(`User & { activePetSkin: PetSkin | null }`)과 타입이 같다. 변환 없이 그대로 `actor: user`로 넘긴다
- `grantAffinity()` 다음에 별도 `try/catch`로 부른다. 트랜잭션에 넣지 않는다 — 미션 실패가 글 작성·메시지 저장을 롤백시키면 안 된다. 중복 완료는 `completeMission` 내부가 P2002를 잡아 `newlyCompleted: false`로 돌려주므로 호출부에서 따로 막지 않는다
- 응답 형태·친밀도 하루 상한 함정 등 자세한 근거는 아래 "결정한 것과 이유"의 `### 미션 완료 연동 (2026-08-21)` 참고

### 7. 클라이언트 인증 — 해소 (2026-08-20, E)
- E가 `lib/auth.ts`를 `cookies()` 기반으로 바꿨다(`ba9287a`). 인증은 `httpOnly` 쿠키(`access_token`)이고 로그인 라우트가 `setSessionCookie()`로 심는다
- 클라이언트가 `Authorization` 헤더를 실을 일이 아예 없어졌다 — 쿠키라 `fetch`가 자동으로 싣는다. 레포 전체에 `Authorization: Bearer` 호출부는 0건이다(`docs/STATUS.md` "인증 방식 확정")
- **결론: D 쪽 fetch 호출부에서 고칠 것이 없었다.** `ChatPanel.tsx`와 커뮤니티 `fetch` 호출은 그대로 두면 된다

### 주의사항 — 재개할 때 잊으면 버그가 된다
- **친밀도 이중 지급**: 챗봇 친밀도(`grantAffinity(user, CHAT_TURN_AFFINITY)`)를 지급하는 곳은 사용자 발화를 저장하는 `app/api/chat/messages/route.ts`의 POST 한 곳뿐이다. Bedrock 응답 저장은 `app/api/chat/stream/route.ts`가 하고 그 라우트는 친밀도를 지급하지 않는다 — 거기에 지급을 추가하면 중복이다
- **미션 완료도 같은 함정**: `DAILY_CHAT` 완료(`completeMissionByCode`) 호출도 같은 이유로 `messages/route.ts`의 POST 한 곳뿐이다. `stream/route.ts`에서 또 부르면 중복이다

---

## 현재 상태
- 완료: 갤러리 목록 화면, 상세 오버레이, 좋아요 토글, 댓글 작성, 글쓰기 모달, **전체 탭 글쓰기**, 본인 글 삭제, 본인 댓글 삭제, 친밀도 지급 헬퍼, 챗봇 시스템 프롬프트, 챗봇 메시지 저장 API(GET/POST, 친밀도 지급까지), 챗봇 패널 UI, Bedrock 스트리밍 응답 연결(`POST /api/chat/stream`), 타이핑 인디케이터, 유형별 챗봇 추천 문구 6개씩·3개 랜덤 노출(LLM 아님, 정적 상수), **챗봇 전역 오버레이 이전(`ChatLauncher` + `layout.tsx`, 임시 `/chat` 라우트 폐기)**, **희망 문구 배너(SPEC.md 9절)**
- 진행 중: 없음
- 미착수: 이미지 업로드, LLM 주제 추천(고정 문구로 대체됨 — 아래 "결정한 것과 이유" 참고)
- 보류(다음 세션 이전 필요 조건): 글쓰기 시 일일 미션(`DAILY_COMMUNITY_POST`) 완료 처리(B와 협의 필요), `ChatPanel`의 `layout.tsx` 이전(E 소유 파일이라 D가 직접 못 건드림) — 전부 아래 "결정한 것과 이유"에 근거 남김

## 구현한 파일
- `app/community/page.tsx` — 목록 화면. 서버 컴포넌트, `searchParams`의 `tab`으로 갤러리 결정
- `app/community/_lib/gallery.ts` — `GalleryTab`("ALL" | TypeCode), `resolveGallery()`, `canAccessGallery()`, `listGalleryPosts()`. "ALL" 관련 로직을 전부 여기 모음
- `app/community/_components/GalleryTabs.tsx` — 탭 2개(전체 커뮤니티 / 나의 종족). 종족 탭은 진단 완료 유저에게만 노출
- `app/community/_components/PostCard.tsx` — 카드 그리드용 게시글 카드. 종족 배지는 전체 탭에서만 노출
- `app/community/_lib/topics.ts` — **2026-08-20 추가.** 글쓰기 주제 추천 문구. `TOPICS: Record<TypeCode, WriteTopic[]>`, 유형별 6개씩 `{ title, draft }`. `app/chat/_lib/starters.ts`와 같은 구조·같은 톤의 주석을 쓴다. `TypeCode`는 `@prisma/client`에서 그대로 import. LLM 호출 없음
- `app/community/_lib/banner.ts` — **2026-08-22 추가, 2026-08-23 갤러리별 분기.** 희망 문구 배너 상수(SPEC.md 9절). `HOPE_MESSAGES: Record<GalleryType, readonly string[]>`(갤러리 4개 × 5개 = 20개) + `pickHopeMessage(gallery, now)`. epoch를 주 단위로 나눈 나머지로 고르므로 교체 시점은 매주 목요일이다. 상단 주석에 문구 톤 규칙 4개(유형명·조언·증상 명명·과장 칭찬 금지)를 적어 뒀다
- `app/community/_components/HopeBanner.tsx` — **2026-08-22 추가.** 커뮤니티 메인 배너. 서버 컴포넌트(상호작용 없음), props는 `{ gallery }` 하나. 전체 탭은 `border-neutral-200 bg-neutral-50`, 종족 갤러리는 `TRIBE[gallery].colorHex`를 `22`/`55` 알파로 인라인 `style`에 넣는다(`PostCard`의 배지 관습과 동일)
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
- `app/community/_lib/gallery.ts` — `canWriteToGallery()` 추가. 전체 탭 글쓰기 차단 로직을 여기 한 곳에 모았고, **2026-08-20**에 스키마가 열리면서 예고대로 이 함수만 고쳐 해소했다. 같은 날 `GalleryTab`을 `GalleryType` 별칭으로 단순화
- `app/community/_components/WriteModal.tsx` — **2026-08-20**: 전체 탭에서도 글쓰기 버튼이 뜬다. `NEUTRAL_COLOR` 상수 추가, `isAll`이면 모달 제목을 "전체 커뮤니티에 글쓰기"로 바꾸고 주제 추천은 렌더하지 않는다
- `app/api/community/posts/route.ts` — **2026-08-20**: POST의 "전체 커뮤니티 글쓰기는 아직 지원하지 않아요" 400 제거, `galleryType`을 `GalleryType` enum 멤버십으로 검증
- `app/community/_components/PostCard.tsx` — 카드를 `<button onClick>`으로 바꿔 클릭 시 상세를 열도록 함
- `app/community/_components/PostList.tsx` — 삭제 완료(`onDeleted`) 시 모달을 닫고 `useRouter().refresh()`로 서버 컴포넌트 데이터를 다시 가져와 목록을 갱신
- `app/community/_components/PostDetailModal.tsx` — `isOwn`일 때만 "삭제" 버튼 노출, 삭제 성공 시 `onDeleted` 콜백 호출
- `app/community/page.tsx` — 헤더에 `WriteModal` 배치(전체/종족 탭 공통, 내부에서 분기). **2026-08-20**: `getCurrentUser()`~`listGalleryPosts()`를 `try/catch`로 감싸고 실패 시 "로그인이 필요해요" 안내를 렌더한다. `export const dynamic = "force-dynamic"` 추가
- `app/community/_components/PostList.tsx` — **2026-08-20**: `<PostDetailModal>`에 `key={selectedPostId}` 추가. 다른 글을 열면 컴포넌트가 새로 마운트되도록 보장한다
- `app/community/_components/PostDetailModal.tsx` — **2026-08-20**: 상세 로드 `useEffect` 본문의 `setLoading(true)`·`setError(null)` 두 줄 삭제(lint `react-hooks/set-state-in-effect` 해소)
- `app/community/_components/WriteModal.tsx` — **2026-08-20**: TODO 주석과 "주제 추천 준비 중이에요" 박스를 주제 추천 카드 3개로 교체. `topics` state와 `pickThreeTopics()`(모듈 스코프, Fisher-Yates 직접 구현) 추가. 글쓰기 버튼 `onClick`에서 뽑고 카드 클릭 시 `setTitle`·`setBody`로 두 입력창을 채운다. 종족 색은 기존 `tribeColor`를 그대로 쓴다
- `app/api/community/posts/route.ts` — POST 추가(글쓰기)
- `app/api/community/posts/[id]/route.ts` — DELETE 추가(본인 글 소프트 삭제), GET 응답에 `isOwn` 추가. GET의 `comments`도 prisma 결과 그대로 내리지 않고 `{ id, body, createdAt, user, isOwn }`으로 매핑(`userId`·`postId`·`deletedAt` 미노출)
- `app/api/community/posts/[id]/comments/route.ts` — POST 응답의 `comment`를 GET 상세와 같은 형태(`{ id, body, createdAt, user, isOwn: true }`)로 매핑. 트랜잭션·`grantAffinity`·`COMMENT_AFFINITY` 로직은 그대로 둠
- `app/community/_components/PostDetailModal.tsx` — `DetailComment`에 `isOwn` 추가, `deletingCommentId` state와 `handleDeleteComment()` 추가. 본인 댓글에만 작은 삭제 버튼(`text-[11px]`, 헤더의 글 삭제 버튼과 같은 계열) 노출

- `app/chat/_lib/systemPrompt.ts` — 챗봇 "마음 친구" 시스템 프롬프트. 공통 원칙(조언·해결책·진단·평가 금지, 유형명 노출 금지, 자해·죽음 언급 시 안전 예외) + 유형별 페르소나 레이어. `buildSystemPrompt(typeCode, nickname)`을 `app/api/chat/messages/route.ts`와 `app/api/chat/stream/route.ts`가 참조
- `app/chat/_components/ChatLauncher.tsx` — **이번 세션에 추가.** 전역 오버레이 진입점(클라이언트). `useState`로 열림 상태를 갖고, 닫혀 있으면 우상단 플로팅 버튼(`fixed top-4 right-4 z-40`, `aria-label="마음 친구 열기"`)만, 열리면 `<ChatPanel onClose={...} />`를 렌더한다. **노출 경로 판정은 2026-08-21 머지로 바뀌었다** — 처음엔 `usePathname()`으로 `/diagnosis`만 제외했으나(당시 `app/(auth)/` 미생성), 지금은 `ALLOWED_PREFIXES = ["/missions", "/pet", "/community"]` + `pathname === "/"` 허용 목록에 더해 `GET /api/diagnosis/me`로 진단 완료 여부까지 확인한다. 아래 "결정한 것과 이유"의 `### 로그인 화면 챗봇 버튼 숨김 (2026-08-21)` 참고
- `app/chat/_lib/starters.ts` — **이번 세션에 추가.** `CHAT_STARTERS: Record<TypeCode, string[]>`. 빈 화면 추천 문구를 유형별 6개씩 정적 상수로 둔다. `TypeCode`는 `@prisma/client`에서 그대로 import(새로 정의하지 않음). LLM 호출 없음
- `app/api/chat/messages/route.ts` — GET(대화 이력 조회, 최근 50개, `createdAt asc`, 이제 `affinityToday`도 응답에 포함) + POST(사용자 메시지 저장 + 친밀도 지급). 진단 전(`typeCode` 없음)이면 400 `NO_TYPE_CODE`
- `app/api/chat/stream/route.ts` — **이번 세션에 추가.** POST. 사용자 메시지 저장 이후 클라이언트가 이어서 호출한다. 최근 20개 대화 이력을 Converse 형식으로 변환해 `ConverseStreamCommand`로 호출하고, 토큰을 `text/plain` 스트림으로 그대로 흘린다. 스트림이 `messageStop`까지 정상 종료됐고 내용이 비어있지 않을 때만 `ChatRole.ASSISTANT`로 저장한다. 메시지 저장·친밀도 지급·미션 완료는 이 라우트에서 하지 않는다(모두 `app/api/chat/messages/route.ts` 소관, 이중 지급 방지). `BEDROCK_MODEL_ID`가 없으면 500 `BEDROCK_NOT_CONFIGURED`로 막는다(클라이언트는 `bedrockConfigured`가 false면 애초에 이 라우트를 호출하지 않는다)
- `app/chat/_components/ChatPanel.tsx` — 우측 460px 슬라이드 패널(클라이언트). 헤더(아바타·진행 바·ℹ 친밀도 안내·✕), 빈 상태(인사말 + 유형별 추천 문구 3개), 메시지 목록(USER 우측 컬러 말풍선 / ASSISTANT 좌측 말풍선), 입력창(Enter 전송·Shift+Enter 줄바꿈). `BEDROCK_MODEL_ID` 없을 때만 개발 모드 배너 노출. `onClose`는 선택 prop — 없으면 ✕·배경 클릭 닫기를 렌더링하지 않음. 이전 세션에 사용자 메시지 저장 성공 직후 `streamAssistantReply()`를 호출해 `/api/chat/stream`을 스트리밍으로 소비하도록 연결(첫 토큰 전엔 타이핑 인디케이터, 이후엔 텍스트가 자라나는 말풍선, 스트리밍 중 입력창·전송 버튼 비활성화)했다. **이번 세션에 수정**: 하드코딩된 `SUGGESTIONS` 배열을 지우고, `CHAT_STARTERS[typeCode]` 6개 중 3개를 뽑는 `pickThreeStarters()`(Fisher-Yates, 외부 라이브러리 없이 직접 구현)를 추가. 결과는 `useState(() => typeCode ? pickThreeStarters(typeCode) : [])` 초기화 함수 안에서 한 번만 계산해 `starters` state로 보관 — 리렌더마다 다시 섞이지 않고, 컴포넌트가 새로 마운트될 때(패널 재진입)만 새로 뽑힌다
- `app/chat/_components/ChatPanel.tsx` — **2026-08-20 수정.** `nickname`/`typeCode`/`bedrockConfigured` props를 없애고 `onClose` 하나만 받는다. 세 값은 이미 호출하던 GET `/api/chat/messages` 응답에서 state로 채운다(요청 횟수 그대로). `typeCode` 초기값 `null` → 로딩 중엔 기존대로 `NEUTRAL_COLOR`. `pickThreeStarters()`는 GET 성공 시점에 `typeCode`가 있을 때만 한 번 호출한다. GET이 401이면 `unauthorized` state로 로그인 안내만 띄우고 입력을 막는다. `onClose`가 항상 넘어오므로 `router.back()` 폴백과 `useRouter` import를 지웠다
- `app/layout.tsx` — **2026-08-20 수정(E 소유 공유 파일, PR 리뷰 예정).** import 한 줄 + `</div>` 뒤 `<ChatLauncher />` 한 줄. `Sidebar`·flex 구조·배경색·`overflowY`는 손대지 않았다
- `app/api/chat/messages/route.ts` — **2026-08-20 수정.** GET 응답에 `nickname`·`typeCode`·`bedrockConfigured` 3필드 추가(additive). `BEDROCK_MODEL_ID` 값 자체는 내보내지 않고 `Boolean()`으로 설정 여부만 내린다. POST 로직과 친밀도 지급은 그대로
- `app/api/chat/messages/route.ts` — **2026-08-21 수정.** POST에 `completeMissionByCode({ actor: user, code: "DAILY_CHAT" })` 연결 + **죽은 Bedrock 코드 정리.** `buildSystemPrompt()` 호출과 `void systemPrompt`, 그 사이 Bedrock TODO 주석을 지웠다(같은 파일에 다른 사용처가 없어 `import { buildSystemPrompt }`도 함께 제거). Bedrock 호출은 `app/api/chat/stream/route.ts`로 분리돼 거기서 같은 함수를 실제로 쓴다 — 이 라우트의 TODO는 낡은 것이었다. "친밀도는 사용자 발화 시점에만 지급하고 Bedrock 응답 저장 시점에 다시 지급하지 않는다"는 경고는 지우지 않고 `grantAffinity` 호출부 위로 옮겨 살렸다
- `app/api/community/posts/route.ts` — **2026-08-21 수정.** POST의 미션 TODO 주석 블록을 지우고 `grantAffinity()` 다음에 `completeMissionByCode({ actor: user, code: "DAILY_COMMUNITY_POST" })`를 연결했다. 친밀도 하루 상한 함정 주석도 여기에 남겼다
- `app/chat/_components/ChatLauncher.tsx` — **2026-08-21 수정 → 머지에서 대체됨.** D가 `pathname === "/diagnosis"` 단일 비교를 `HIDDEN_PATHS` 배열 + `includes()`로 바꾸고 `/login`·`/signup`을 추가했으나(`c8b4d08`), 같은 날 `origin/develop` 머지에서 A/E의 허용 목록 방식(`ALLOWED_PREFIXES` + `/api/diagnosis/me` 확인)으로 대체됐다. **현재 이 파일에 D의 변경분은 남아 있지 않다.** 경위는 아래 "결정한 것과 이유"의 `### 로그인 화면 챗봇 버튼 숨김 (2026-08-21)` 참고

**`app/chat/` 폴더 소유 — 팀 확인 대기.** `CLAUDE.md` 2절의 폴더 소유 표(`app/diagnosis/` A, `app/missions/` B, `app/pet/` C, `app/community/` D, `app/(auth)/` E)에는 `app/chat/`이 없다. `업무분담.md`의 D 항목에 "AI 상담 챗봇"과 `/api/chat/*`가 D 담당으로 명시돼 있어 D 소유로 보고 진행했지만, `CLAUDE.md` 갱신은 전원 합의가 필요하므로 다음 통합 때 팀에 확인해 `CLAUDE.md` 2절에 정식으로 추가해야 한다.

## 삭제한 파일
- `app/chat/page.tsx` — **2026-08-20 삭제.** `layout.tsx`를 못 고쳐서 만들었던 임시 확인용 라우트. 전역 오버레이(`ChatLauncher`)로 대체돼 `/chat`은 이제 404다. `app/chat/_components/`·`app/chat/_lib/`·`app/api/chat/`은 그대로 둔다
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
- **(지난 세션) 전체 탭 글쓰기는 보류였다.** `Post.galleryType`이 `TypeCode` enum이라 `ALL`을 저장할 수 없어 클라이언트·서버 양쪽에서 막았다. 2026-08-20에 아래대로 열었다.

### 전체 탭 글쓰기 (2026-08-20)
- **`GalleryTab`을 `GalleryType`(@prisma/client) 별칭으로 바꿨다.** enum 값이 `"ALL" | TypeCode`와 정확히 같아서 합성 타입을 유지할 이유가 없어졌다. 파급도 없다 — `GalleryTabs`·`page.tsx`·POST 라우트는 값 비교만 하고 있어 그대로 통과한다
- **`canWriteToGallery()`는 항상 `true`를 반환하고 인자를 받지 않는다.** 이제 모든 갤러리에 쓸 수 있어 인자를 안 쓰는데, 인자를 남기면 `@typescript-eslint/no-unused-vars` 경고가 새로 생긴다(이 프로젝트는 `_` 접두사도 경고 대상 — `_request` 사례). 호출부가 두 곳뿐이고 둘 다 이번에 고치는 파일이라 시그니처를 줄였다. 함수 자체는 해소 사실을 남기려고 유지한다. 종족 갤러리 소속 검사는 예전부터 `canAccessGallery()` 몫이다
- **POST 라우트는 `Object.values(GalleryType)` 멤버십으로 검증한다.** 예전엔 임의 문자열을 `as GalleryTab`으로 캐스팅해 그대로 저장했다. 이제 enum에 없는 값은 400 `INVALID_BODY`로 막고, 통과한 값만 `canAccessGallery()`로 소속을 본다(ALL은 누구나, 종족은 본인만). 친밀도는 그대로 `POST_AFFINITY` 20이다 — 전체 탭 글도 종족 갤러리 글과 같다
- **전체 갤러리 중립 색(`NEUTRAL_COLOR = "#9CA3AF"`)을 `WriteModal.tsx` 안에 뒀다.** `TRIBE`에는 ALL 키가 없고 `lib/types.ts`는 A 소유 공유 파일이라 건드리지 않는다. `ChatPanel`이 진단 전 유저를 위해 같은 상수를 자기 파일에 둔 선례를 따랐다 — 값이 두 곳에 생기지만, 공유 파일을 브랜치에서 고치는 비용이 더 크다(`CLAUDE.md` 1절)
- **전체 탭에는 주제 추천을 넣지 않는다.** `TOPICS`는 유형별 문구이고 ALL 키가 없다. 여기에 ALL용 문구를 새로 만들면 "사용자 성향에 맞는 추천"이 아니라 아무에게나 같은 문구를 주는 것이 되어 기능의 의미가 사라진다. 전체 탭에서는 `setTopics([])`로 두고 기존 `topics.length > 0` 조건이 영역 자체를 렌더하지 않게 했다
- **(지난 세션) LLM 주제 추천은 보류였다.** `WriteModal`에 비활성 영역과 TODO 주석만 남겼었다. 2026-08-20에 고정 문구로 구현하며 이 자리를 교체했다(아래 항목).
- **주제 추천을 LLM이 아니라 고정 문구로 구현했다(2026-08-20).** `SPEC.md` 8절은 "LLM이 사용자 성향에 맞는 작성 주제·초안을 3가지 이상 추천"을 명시하지만, 남은 일정상 Bedrock 연동 대신 유형별 고정 문구를 택했다. 챗봇의 `app/chat/_lib/starters.ts`가 이미 같은 방식으로 돌아가고 있어 패턴을 그대로 본떴다. **구조는 LLM 전환이 열려 있다** — `WriteModal`은 `TOPICS[gallery]`에서 3개를 받아 쓰기만 하므로, 나중에 `topics.ts`를 Bedrock 호출로 바꾸면 컴포넌트는 그대로 둘 수 있다. **발표에서 이 기능을 AI 생성이라고 소개하지 않는다**
- **문구 작성 규칙을 지켰다.** 오늘 하루 안에서 쓸 수 있는 가벼운 소재만 쓰고, 인생 계획·목표 같은 무거운 주제와 "~해보세요" 같은 권유형을 넣지 않았다(소재를 주는 것이지 조언이 아니다). 유형명을 문구에 드러내지 않고, 자해·죽음·질병 진단은 소재로 삼지 않았다. 유형별로는 혼자 보낸 시간의 작은 장면(`INDEPENDENT_LOW_INCOME`) / 아무것도 못 한 하루도 그대로 쓸 수 있는 주제(`HEALTH_EMOTION`) / 집 안에서 혼자 느낀 감정(`FAMILY_LIVING`)으로 방향을 갈랐다 — 각각 돈·일, 운동·습관 개선, 가족 평가·대화 권유를 소재에서 뺐다
- **`pickThreeTopics()`는 모달을 열 때 호출한다.** `useState` 초기화 함수에 두면 페이지 로드 시 한 번 뽑혀 모달을 다시 열어도 같은 목록이 나오고, 렌더 중에 뽑으면 입력하는 동안 목록이 바뀐다. 글쓰기 버튼의 `onClick`에서 `setTopics(...)` + `setIsOpen(true)`를 함께 호출해 "열 때 한 번만"을 만족시켰다. 셔플은 `ChatPanel.pickThreeStarters()`와 같은 Fisher-Yates 직접 구현이다(외부 라이브러리 없음)
- **`topics` state는 `canWriteToGallery()` 조기 return보다 위에 선언한다.** 아래에 두면 전체 탭에서 훅 호출 개수가 달라져 React가 터진다
- **전체 탭에서는 추천 영역을 아예 렌더하지 않는다.** `gallery`가 `"ALL"`이면 `TypeCode`를 알 수 없어 `TOPICS[gallery]`를 못 쓴다. 전체 탭은 어차피 글쓰기가 막혀 있어 이 경로를 타지 않지만, `topics.length > 0` 조건으로 방어적으로 막아뒀다
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

### 전역 오버레이 이전 (2026-08-20)
- **열림 상태는 `ChatLauncher`(클라이언트)가 갖는다.** `layout.tsx`는 서버 컴포넌트라 `useState`를 못 쓴다. 래퍼를 하나 두면 `layout.tsx` diff가 두 줄로 끝나고, E가 리뷰할 공유 파일 변경 폭이 최소가 된다
- **`ChatPanel`의 세 props를 없애고 GET 응답을 넓혔다.** 전역 오버레이가 되면서 props를 넘겨줄 서버 컴포넌트가 사라졌다. 대안 두 개를 검토하고 버렸다 — (1) `layout.tsx`를 `async`로 만들어 `getCurrentUser()`를 부르는 방법은 진단·로그인 화면처럼 유저가 없는 경로에서 레이아웃이 `UnauthorizedError`로 터지고, 모든 페이지가 동적 렌더링이 되며, E 소유 파일의 변경 폭이 커져 리뷰가 어렵다. (2) props를 optional로 바꾸는 건 값의 출처 문제를 미루기만 한다. 그래서 D 소유 라우트인 GET `/api/chat/messages`에 `nickname`·`typeCode`·`bedrockConfigured`를 additive로 얹었다 — 패널이 이미 마운트 시 호출하던 엔드포인트라 **요청 횟수는 그대로다**
- **`BEDROCK_MODEL_ID` 값은 응답에 넣지 않는다.** `Boolean(...)`으로 설정 여부만 내린다. 모델 ID는 서버 전용 값이고 화면에 필요한 건 배너를 띄울지 여부뿐이다
- **개발 모드 배너는 `!loading`일 때만 띄운다.** `bedrockConfigured` 초기값이 `false`라 로딩 중에 배너가 잠깐 번쩍이는 것을 막는다(props로 받던 때는 첫 렌더부터 확정값이라 이 문제가 없었다)
- **`pickThreeStarters()`는 GET 성공 시점에 한 번만 호출한다.** `typeCode`가 채워진 뒤라야 호출할 수 있고, `useState` 초기화 함수 자리에서는 아직 `null`이다. 리렌더마다 다시 섞이지 않는다는 기존 성질은 그대로다
- **401은 진단 안내가 아니라 로그인 안내를 띄운다.** 둘 다 `typeCode`가 `null`이라 구분 없이 두면 로그인이 안 된 사용자에게 "진단을 먼저 완료해야" 라고 잘못 안내한다. `unauthorized` state로 갈라 로그인 안내만 띄우고 입력을 막는다(크래시 없음)
- **`/diagnosis`에서는 플로팅 버튼을 숨긴다.** `Sidebar`가 같은 경로에서 같은 방식(`usePathname()`)으로 숨는다 — 진단 문항 화면의 몰입을 깨지 않기 위한 기존 결정에 동작을 맞췄다. 로그인 라우트는 아직 없어서(`app/(auth)/` 미생성) 제외 경로는 `/diagnosis` 하나뿐이다. 로그인 화면이 생기면 여기에 함께 추가한다 — **(2026-08-21 갱신) 이 방식은 허용 목록으로 대체됐다. 아래 `### 로그인 화면 챗봇 버튼 숨김 (2026-08-21)` 참고**
- **`router.back()` 폴백을 지웠다.** `/chat` 라우트로 직접 들어오는 경우를 위한 코드였는데 그 라우트를 없앴고, `ChatLauncher`가 항상 `onClose`를 넘긴다. `useRouter` import도 다른 데서 안 써서 같이 정리했다

### 인증 실패 처리와 lint (2026-08-20)
- **커뮤니티 목록도 인증 실패에 안내를 띄운다.** 프로덕션(`DEV_AUTH_BYPASS` 없음)에서는 `getCurrentUser()`가 그대로 throw해 페이지가 500이 됐다. C의 `app/pet/page.tsx`가 쓰는 `try/catch` + 안내 렌더 패턴을 그대로 맞췄다 — 새 패턴을 만들지 않았다
- **에러 종류로 문구를 가르지 않는다.** 인증 실패든 DB 실패든 안내 한 장이면 충분하다. 갈라 놓으면 화면 상태가 늘어나기만 하고, 지금 단계에서 사용자가 할 수 있는 행동(로그인·진단)은 어차피 같다
- **`export const dynamic = "force-dynamic"`이 필수다.** 없으면 빌드 시점에 catch 쪽 안내 화면이 정적으로 굳어 로그인한 뒤에도 그게 나온다. `pet/page.tsx`가 같은 이유로 넣어뒀다(`searchParams` 덕에 이미 동적이지만 의도를 명시해 둔다)
- **`set-state-in-effect`는 `key`로 풀었다.** `PostDetailModal`의 상세 로드 이펙트가 본문에서 `setLoading(true)`·`setError(null)`을 불러 lint 에러였다. 두 줄은 `useState` 초기값과 같은 상태를 다시 세팅하는 것이라, `PostList`가 `key={selectedPostId}`로 렌더해 글이 바뀌면 새로 마운트되도록 보장한 뒤 지웠다. 이펙트에 의존성 배열을 늘리거나 리셋 로직을 추가하는 방식은 쓰지 않았다
- **`BottomNav.tsx`는 그대로 뒀다.** `layout.tsx`가 더 이상 쓰지 않는 죽은 파일이지만 D 소유가 아니다(삭제 판단은 E). `docs/STATUS.md` 차단 10번에 E 항목으로 이미 올라가 있다

### 미션 완료 연동 (2026-08-21)
- **`completeMissionByCode({ actor, code })`로 붙였다.** 주석에 준비해뒀던 `completeMission(user.id, code)` 형태와 시그니처가 달라 주석을 그대로 풀지 않고 새로 썼다. 두 라우트가 이미 `getCurrentUserWithSkin()`을 쓰고 있어 `user`가 `ActorWithSkin`(`User & { activePetSkin: PetSkin | null }`)과 타입이 같다 — 변환 없이 그대로 `actor: user`로 넘긴다
- **호출 위치는 `grantAffinity()` 다음이고 별도 `try/catch` 안이다.** 트랜잭션에 넣지 않는다 — 미션 실패가 글 작성·메시지 저장을 롤백시키면 안 된다. 중복 완료는 `completeMission` 내부가 P2002를 잡아 `newlyCompleted: false`로 돌려주므로 호출부에서 따로 막지 않는다
- **응답 형태는 그대로 두었다**(`{ post, granted }` / `{ message, granted }`). 미션 결과를 얹지 않는다 — 커뮤니티·챗봇 화면은 미션 완료를 표시하지 않고, 미션 대시보드는 B 소유의 별도 화면이다
- **잠재 함정 — 친밀도 하루 상한.** `completeMission`은 넘겨받은 `actor.affinityToday`(메모리 값)로 상한을 계산하는데 바로 위 `grantAffinity`는 DB만 갱신하고 `user` 객체를 변형하지 않는다. 두 미션의 `rewardAffinity`가 0이라(`prisma/seed/missions.ts`, 2026-08-20 결정) 지금은 무해하지만, 0보다 큰 값을 넣으면 이 호출이 낡은 `affinityToday`를 보고 하루 상한 100을 넘길 수 있다. 두 호출부 중 커뮤니티 쪽에 같은 취지의 주석을 남겨뒀다

### 로그인 화면 챗봇 버튼 숨김 (2026-08-21) — 최종 구현은 허용 목록 방식
- **증상**: `app/(auth)/`가 생기면서 미인증 화면에도 플로팅 버튼이 떴고, 누르면 GET `/api/chat/messages`가 401을 내 로그인 화면 위에 로그인 안내 패널이 겹쳤다. `(auth)`는 라우트 그룹이라 URL에 나타나지 않으므로 실제 경로는 `/login`·`/signup`이다
- **D가 먼저 `HIDDEN_PATHS = ["/diagnosis", "/login", "/signup"]`로 고쳤고(`c8b4d08`), 2026-08-21 `origin/develop` 머지에서 A/E의 허용 목록 방식으로 대체됐다.** 숨길 경로를 나열하는 방식은 화면이 늘 때마다 목록에서 빠뜨린다 — 실제로 `/diagnosis/result`가 그렇게 빠져 별도 차단(`docs/STATUS.md` 21번)으로 올라와 있었다. 허용 목록은 새 화면이 기본적으로 "챗봇 없음"이 되므로 빠뜨림이 구조적으로 생기지 않는다
- **현재 구현**: `ALLOWED_PREFIXES = ["/missions", "/pet", "/community"]` 접두사 일치 + `pathname === "/"` 정확 일치만 통과한다. `/pet/skins`·`/pet/cosmetics` 같은 하위 경로가 있어 접두사로 본다. `/login`·`/signup`·`/diagnosis`·`/diagnosis/result`는 목록에 없어 전부 자동으로 제외된다(차단 20번 + 21번의 D 몫 해소)
- **`useEffect`가 `GET /api/diagnosis/me`를 확인한다.** 소개 화면과 홈은 경로가 둘 다 `/`라 경로만으로는 갈리지 않는다 — 진단 완료 여부로 나뉜다. 진단 미완료(미인증 포함)거나 응답을 못 읽으면 버튼을 띄우지 않는다. 진단 전 화면에 챗봇이 뜨는 쪽이 더 나쁘다는 판단이다
- 위 "전역 오버레이 이전"(2026-08-20)의 "제외 경로는 `/diagnosis` 하나뿐" 기록은 이 항목으로 대체된다

### 희망 문구 배너 — 갤러리별 분기 (2026-08-23)
- **SPEC.md 9절의 "3~5개"를 "갤러리당 5개"로 읽었다.** 9절은 갤러리별 분기를 상정하지 않은 문장이라 총 개수인지 갤러리당 개수인지가 열려 있다. 갤러리당으로 읽었다 — 9절이 개수 상한을 둔 이유는 "자주 바뀌면 피로해진다"는 교체 빈도 문제이고, 그 빈도는 **한 사용자가 한 화면에서 겪는 것**이기 때문이다. 갤러리당 5개여도 한 사용자가 한 탭에서 보는 문구는 여전히 주 1회 교체되는 5개 순환이라 9절의 취지는 그대로 지켜진다. 총 20개로 읽어 갤러리당 5개를 채우지 못하면 유형별 분기가 성립하지 않는다
- **문구는 `app/chat/_lib/systemPrompt.ts`의 PERSONA 제약을 그대로 따른다.** 유형명을 쓰지 않고("고립은둔", "저소득" 같은 말이 화면에 나오면 안 된다), 조언하지 않고("~해보세요" 금지), 증상에 이름을 붙이지 않고("우울", "번아웃" 금지), 과장해서 칭찬하지 않는다. 배너는 챗봇과 같은 사용자가 같은 세션에서 보는 화면이라 톤이 갈리면 서비스가 두 목소리로 말하는 것처럼 읽힌다. 이 4개 규칙은 `banner.ts` 상단 주석에도 적어 뒀다 — 나중에 문구를 고칠 사람이 PERSONA까지 찾아가지 않아도 되게 했다
- 결과적으로 각 배열은 그 유형이 실제로 겪는 장면에 붙는다: `HEALTH_EMOTION`은 무기력한 하루를 재촉하지 않고, `INDEPENDENT_LOW_INCOME`은 지원 제도나 해결책을 꺼내지 않으며, `FAMILY_LIVING`은 가족을 판단하지 않는다. `_lib/topics.ts`의 유형별 카피와 같은 결이다
- 타입은 `Record<GalleryType, readonly string[]>`로 선언했다. `GalleryType` enum에 갤러리가 추가되면 배열을 빠뜨린 채 빌드가 통과하지 않고 타입 에러로 잡힌다
- `GalleryType`은 `_lib/gallery`가 아니라 `@prisma/client`에서 **타입만** import한다. `gallery.ts`를 거치면 타입 하나 때문에 `prisma` 런타임 코드가 딸려온다
- 주차 인덱스는 갤러리와 무관하게 한 번만 계산하고 각 배열 길이로 나머지를 구한다. 지금은 네 배열이 전부 5개라 **네 갤러리가 같은 주에 함께 넘어간다.** 어느 하나의 길이를 바꾸면 그 갤러리만 다른 주기로 돌게 되므로 길이는 넷을 같이 움직인다(`banner.ts` 주석에도 기록)

### 희망 문구 배너 (2026-08-22)
> 문구 구성은 위 2026-08-23 항목으로 대체됐다(단일 배열 `MESSAGES` 5개 → 갤러리별 `HOPE_MESSAGES` 4×5). 아래의 교체 주기·색 기준·서버 컴포넌트 판단은 그대로 유효하다.

- **프로토타입의 문구 10개·1시간 교체를 버리고 SPEC.md 9절대로 5개·주 1회로 맞췄다.** 9절은 "3~5개 하드코딩, 주 1회 단위로만 교체"를 명시하고 그 이유("자주 바뀌면 사용자가 피로해진다")까지 적어 뒀다. 시간 단위 교체는 새로고침할 때마다 문구가 바뀌는 것에 가까워 그 취지와 정면으로 어긋난다. 문구 수도 상한인 5개에 맞췄다
- 교체 주기는 `Math.floor(now.getTime() / 604_800_000) % MESSAGES.length`다. `Math.random()`은 쓰지 않는다 — 서버 컴포넌트라 렌더마다 다시 평가돼 같은 주에도 문구가 흔들린다. epoch(1970-01-01)가 목요일이라 **교체 시점이 매주 목요일**이 된다는 점은 `banner.ts` 주석에 남겼다. 요일을 옮기려면 나누기 전에 오프셋을 더해야 한다
- **배너 색은 유저의 종족이 아니라 현재 보고 있는 `gallery`를 따른다.** 전체 탭에서 유저 종족색을 쓰면 "지금 내 종족 갤러리에 있다"는 오해를 준다 — 배너는 화면에서 가장 큰 색 덩어리라 탭보다 먼저 읽힌다. `gallery` 기준으로 두면 전체 탭은 중립색(`bg-neutral-50`), 종족 갤러리는 그 종족색이 되어 배너가 "지금 어느 공간에 있는지"를 탭과 같은 방향으로 알려준다. `GalleryTabs`가 유저 종족(`myTypeCode`)을 쓰는 것과는 기준이 다른데, 그쪽은 "네가 갈 수 있는 탭"을 그리는 것이라 대상이 다르다
- 종족색은 `PostCard`의 배지 관습(`${hex}22`)을 그대로 따랐고 테두리만 `55`를 더 썼다. 동적 색이라 이 두 값만 인라인 `style`이고 나머지는 전부 Tailwind다(`styles/tokens.css`는 import하지 않는다 — community는 Tailwind 단일 체계)
- 상호작용이 없어 서버 컴포넌트로 뒀다. `page.tsx` 변경은 import 한 줄 + `<HopeBanner gallery={gallery} />` 한 줄뿐이고, `try/catch`의 "로그인이 필요해요" 화면에는 넣지 않았다(그 화면에는 `gallery`가 정해지지 않는다)

## 막힌 것
- 없음 (로컬 DB가 `prisma migrate`로 관리되지 않고 있던 것을 발견해 베이스라인 마이그레이션(`prisma/migrations/00000000000000_init`)을 만들어 해결. 기존 시드 데이터(미션 41개, 펫스킨 6개)는 유지됨. 스키마 담당과 공유 필요)

## 다음 할 일
- ~~LLM 주제 추천 3가지 이상 연동~~ — **고정 문구로 대체했다(2026-08-20).** `app/community/_lib/topics.ts`의 유형별 6개 중 3개를 `WriteModal`이 카드로 보여준다. 나중에 LLM으로 전환한다면 `topics.ts`만 Bedrock 호출로 바꾸면 되고 컴포넌트는 그대로 둘 수 있다(비스트리밍 단발 호출이라 `ConverseCommand`가 맞다). SPEC 8절과의 차이와 발표 시 주의는 "결정한 것과 이유" 참고
- **`layout.tsx` 변경분 PR 리뷰 — E.** 전역 오버레이 이전은 끝났고(2026-08-20) E와 사전 공유했다. 공유 파일이므로 머지 전 PR 리뷰를 받는다. diff는 import 한 줄 + `<ChatLauncher />` 한 줄뿐이다
- `app/chat/` 폴더 소유를 `CLAUDE.md` 2절에 정식 반영 — 팀 확인 대기 (계속 남아있는 이월 항목)
