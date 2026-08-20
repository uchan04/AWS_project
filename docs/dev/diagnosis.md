# 유형 진단 개발 문서 (담당 A)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 2·3·4절, 규칙은 `CLAUDE.md`.

**이 문서의 4~9장은 확정된 실행 스펙이다.** 값을 새로 정하지 말고 그대로 옮겨 구현한다. 값을 바꿔야 할 이유를 발견하면 먼저 사용자에게 알린다.

**브랜치 규칙 (2026-08-19 변경).** A 담당분은 `feat/diagnosis`에 커밋한다. `main`에 직접 커밋하지 않고 PR로만 올린다. `prisma/schema.prisma` 변경분도 이 브랜치에 담고, 머지 여부와 `prisma migrate dev` 실행은 팀이 결정한다.

## 현재 상태
- 완료: 미션 41개, 지표 14개 정의, 12문항 + 형용사 문항, `classify()`·`classifySub()`, 무손실 조기 종료, 스냅샷 체크, 화면 3장(진단·결과·홈), 화면 3장 디자인 시스템 적용 + Figma 팔레트·폰트 반영(12장), 진단 API 3종 + 화면 연결, `draft.ts` 제거, 2차 마이그레이션 적용 후 실 DB로 전체 흐름 확인(14장), **스킨·치장·가챠 구조 변경을 스키마·실 DB·시드까지 적용(15장)**
- 진행 중: 없음
- 미착수: Bedrock 호출 2종, 관리자 교차표, 홈의 펫·미션 실데이터(B·C API 대기)
- A 담당분이 아니지만 A가 처리한 것: 15장의 스키마 변경과 그에 딸린 `prisma/seed/items.ts`·`scripts/check-reward.ts`(C 소유) 수정. 이유는 15장에 적었다

## 구현한 파일
- `lib/types.ts` — 종족·동물·색, 형용사 매핑, 기본 닉네임, 성장 곡선 상수
- `prisma/seed/missions.ts` — 미션 41개. 일일 5 + 단계 36(유형 3 × 단계 3 × 4). 보상·사진 배치는 `stageMission()`이 강제한다
- `lib/diagnosis/questions.ts` — 12문항 + 형용사 문항의 서버 원본. 선택지가 어떤 지표를 켜는지도 여기 있다
- `lib/diagnosis/indicators.ts` — 답변 → 지표 14개. 대분류·세부유형이 전부 이 결과만 본다
- `lib/diagnosis/classify.ts` — `classify()`(3대분류) + `classifySub()`(8세부유형). 순수 함수, LLM·DB 없음
- `lib/diagnosis/adaptive.ts` — `possibleTypes()` / `canDecide()` / `nextQuestion()`. 무손실 조기 종료
- `scripts/check-diagnosis.ts` — `npm run check:diagnosis`
- `app/diagnosis/page.tsx` — 진단 화면 한 장. 클라이언트 컴포넌트. 답변은 state에만 있고 문항마다 서버를 부르지 않는다. 진행 문구는 `canDecide()`로 갈린다(확정 전 "n번째 질문이에요", 확정 후 "거의 다 왔어요")
- `app/api/diagnosis/complete/route.ts` — 답변을 받아 서버에서 판정하고 `User`·`DiagnosisSession`을 한 트랜잭션에 저장한다. 응답에 세부유형·지표를 넣지 않는다
- `app/api/diagnosis/me/route.ts` — 현재 유저의 판정. 진단 전이면 `data: null`
- `app/api/diagnosis/nickname/route.ts` — 닉네임 PATCH. 2~12자 검증
- `app/diagnosis/api.ts` — 세 화면이 쓰는 호출부. `draft.ts`를 대신한다. `{data}`/`{error}` 봉투를 여기서만 벗긴다
- `app/diagnosis/result/page.tsx` — 결과 화면. `GET /me`로 읽는다. 닉네임은 값을 바꿨을 때만 PATCH하고 홈으로 넘어간다
- `app/page.tsx` — 홈. `GET /me`가 `null`이면 시작 화면, 있으면 종족 헤더 + 펫·미션·커뮤니티 진입점
- `styles/tokens.css` — 화면 3장이 쓰는 디자인 토큰과 컴포넌트 클래스. `app/globals.css`(E 소유)를 고치지 않기 위해 전부 `.hm` 아래로 범위를 가둔다. 12장
- `design.md` — 3화면이 공유하는 디자인 기준(색·타이포·모션·상태). 화면을 새로 만들 때 이 문서를 먼저 본다

---

## 1. 작업 순서

DB가 아직 없다(`DATABASE_URL` 미공유). **DB가 필요 없는 것부터 한다.**

### 1단계 — DB 없이 — **완료**

1. ~~미션 콘텐츠 36개~~
2. ~~지표·문항·판정~~ (2026-08-19 지표 기반으로 재작성)
3. ~~조기 종료~~
4. ~~스냅샷 체크~~

### 2단계 — DB 없이 계속 — **완료**

5. ~~진단 화면~~ — 브라우저에서 실제로 클릭해 확인했다(첫 선택지 경로 9문항, 두 번째 선택지 경로 12문항)
6. ~~홈 화면~~
7. ~~결과 화면~~ — 두 번째 선택지 경로에서 고양잇과·스카이 블루·"다정한 고양이"가 나오는 것까지 확인

### 3단계 — DB 연결 후

8. ~~진단 완료 API, 닉네임 PATCH~~ — 완료(10장). `draft.ts`와 화면의 `classify()` 호출을 함께 지웠다. 이제 판정 코드가 클라이언트 번들에 들어가지 않으므로 세부유형 코드명도 브라우저 소스에 남지 않는다
9. 관리자 교차표 (대분류 × 세부유형)

### 4단계 — Bedrock 확인 후

10. 자유 입력 → 선택지 코드 변환 (tool use, 실패 시 버튼 폴백)
11. 판정 근거 3줄 요약 → `DiagnosisSession.reasonText`
12. 질문 문장 다듬기 — **A 담당분 중 가장 먼저 자를 항목**

---

## 2. 결정한 것과 이유

- 판정은 100% 코드. LLM은 문장 다듬기와 자유 입력 enum 변환만 담당한다
- **답변 → 지표 14개 → 판정** 순서로 한 단계를 끼웠다. 대분류와 세부유형이 같은 지표를 보므로 규칙을 고칠 때 한 곳만 고친다
- **대분류(3)와 세부유형(8)은 각각 독립으로 판정하고 둘 다 저장한다.** 세부유형에서 대분류를 고정 매핑으로 뽑으면, 미취업빈곤형처럼 주거 상황에 따라 갈려야 하는 유형이 한 집단에 몰려 미션 배정이 틀린다. 관리자 화면은 "대분류 × 세부유형" 교차표로 보므로 8개가 3집단으로 쪼개진 모습은 그대로 보인다
- **경계선지능청년은 8유형에서 제외했다.** IQ 71~84는 자기보고로 측정할 수 없고, 묻는 것 자체가 낙인이다
- 문항은 **직설적으로 묻지 않는다.** 소득·고립·우울을 그대로 묻는 문장은 쓰지 않는다. 판정은 코드가 하므로 문장을 은유로 바꿔도 정확도가 흔들리지 않는다
- 우울은 PHQ-9을 쓰지 않는다. PHQ-9 9번 문항이 자살 사고를 묻고, 이 프로젝트에는 위기 대응 절차가 없다. **PHQ-2 근사(2문항 합 3점 이상)** 로 대체한다
- 형용사는 마지막 문항 4지선다에 1:1 매핑. `lib/types.ts`의 `ADJECTIVE_BY_CHOICE` 상수 테이블
- 진단 로직은 `lib/diagnosis/` 하위. `lib/types.ts`는 4명이 import하는 공유 파일이라 문항·판정 코드를 넣지 않는다
- 화면은 선택지 버튼만으로 먼저 완성한다. Bedrock이 늦어져도 진단 플로우 전체가 동작해야 한다
- **`GET /api/diagnosis/me`를 계약에 추가했다.** 원래 계약에는 완료 API와 닉네임 PATCH만 있었다. 결과 화면과 홈이 새로고침·직접 진입을 견뎌야 하는데, 판정 결과를 클라이언트에 다시 저장하면 `draft.ts`를 없앤 이유가 사라진다. 서버에 한 번 더 물어보는 쪽이 싸다
- **재진단은 닉네임을 덮어쓰지 않는다.** 저장된 닉네임이 이전 판정의 기본 닉네임과 똑같을 때만 새 기본 닉네임으로 바꾼다. 유저가 직접 고친 이름은 유지되고, 종족이 바뀌었는데 "조용한 여우"가 남는 경우는 고쳐진다
- **재진단은 레벨·경험치·재화·아이템·연속 기록을 건드리지 않는다.** 유형이 바뀌어도 키운 것은 남는다. 활성 펫 스킨만 새 유형의 기본 스킨으로 바꾼다
- **완료 API는 기본 펫 스킨이 없어도 실패하지 않는다.** `npm run db:seed`가 C의 `items.ts` 때문에 아직 막혀 있어서, 시드 전에도 진단은 끝까지 되어야 한다
- **하단 탭을 없애고 사이드바 하나만 쓴다** (2026-08-19, 사용자 결정). E가 "데스크톱은 사이드바 / 모바일은 하단 탭" 이원화를 제안했지만, 내비게이션이 두 벌이면 화면마다 어느 쪽이 뜨는지 확인해야 하고 활성 표시·경로도 두 곳에서 갈린다. 마감이 3일 남은 상태에서 감당할 비용이 아니다. 모바일에서는 같은 사이드바를 아이콘만 남긴 좁은 레일로 줄인다. 진단 문항 화면에서는 내비를 숨긴다(이탈 방지). 적용은 E, 적용되면 A가 `styles/tokens.css`의 `--nav-h`를 지우고 `min-height: 100dvh`로 되돌린다
- **미션 데이터는 DB가 원본, `prisma/seed/missions.ts`는 그 DB를 채우는 시드다** (B와 합의, 2026-08-19). 화면에 41개 문구를 다시 복사하지 않는다. B는 `시드 → DB Mission → GET /api/missions → 화면`으로 가고, A의 홈 미션 미리보기도 그 API가 생기면 그쪽으로 바꾼다. 그때까지 홈이 `DAILY`를 직접 읽는 것은 임시다 — `prisma/seed/missions.ts:1`이 `import type`뿐이라 Prisma가 클라이언트 번들에 들어가지 않는 것은 빌드 산출물에서 확인했다(`.next/static/chunks`에 `PrismaClient` 없음, 미션 문구는 있음)
- **6·7장의 기대값을 먼저 확정한 뒤 판정 함수를 구현한다.** 순서를 뒤집으면 구현 결과를 그대로 기대값으로 박게 되고, 테스트가 아무것도 검증하지 않는다. 이 테스트가 발표에서 제시할 정확도 근거다

## 3. 막힌 것

해소된 것 (2026-08-19):

- ~~2차 마이그레이션 미적용~~ — E가 `20260819080703_add_subtype`을 `main`에 올렸다. `migrate deploy`로 적용 완료. `P2022`로 500이던 진단 API 3종이 정상 동작한다
- ~~`lib/auth.ts`가 모듈 로드 시점에 Cognito 검증기를 만들어 빌드가 깨짐~~ — E가 `getVerifier()` 지연 생성으로 고쳤다. `.env`에 넣었던 더미 Pool ID·Client ID를 지웠다(`DEV_AUTH_BYPASS=true`면 빈 값이어도 빌드가 통과한다)

남은 것:

- Bedrock 연결 확인 미완 (E 대기). 4단계(자유 입력 enum 변환·근거 3줄 요약)에서 필요하고, 그전까지 진단은 선택지 버튼만으로 끝까지 동작한다
- `prisma/seed/items.ts`의 펫 3종이 아직 옛 동물 매핑이다. **C 담당 파일이라 내가 못 고친다.** 첫 `npm run db:seed`보다 먼저 고쳐야 한다. 그래서 `activePetSkinId`가 아직 `null`이고 홈·결과의 마스코트는 이모지다
- 홈 미션 미리보기가 아직 `prisma/seed/missions.ts`의 `DAILY` 배열을 읽는다. B가 `GET /api/missions`를 올리면 그쪽으로 바꾼다(2장 마지막 항목)
- ~~하단 탭 제거 + 사이드바 단일 구조가 아직 적용되지 않았다~~ — 적용됐다(2026-08-20). E가 아니라 **B**가 `app/components/Sidebar.tsx`를 만들고 `app/layout.tsx`에서 `BottomNav`를 뺐다(`65308c4`). A는 그에 맞춰 `styles/tokens.css`의 `--nav-h`를 지우고 `min-height: 100dvh`로 되돌렸다. 남은 뒷정리는 A 몫이 아니다 — 15장 "머지 후 발견한 문제" 참고
- Google 로그인 전용 결정이 `SPEC.md` 10절("소셜 로그인은 쓰지 않는다")과 `CLAUDE.md` 8절과 충돌한다. 둘 다 공유 문서라 임의로 안 고친다

---

## 4. 지표 스펙 (확정)

지표는 전부 boolean이다. 문항의 선택지가 지표를 켠다. 판정 함수는 지표만 본다.

| # | 코드 | 뜻 | 출처 문항 |
|---|---|---|---|
| ① | `ALONE` | 1인 가구 (가족과 동거하지 않음) | Q1 |
| ② | `HOUSING_UNSTABLE` | 주거 불안정 (월세·공과금 부담, 퇴거 위험) | Q2 |
| ③ | `MENTAL_UNMET` | 정신건강 진료 미충족 | Q6 |
| ④ | `PHYSICAL_UNMET` | 신체건강 진료 미충족 | Q6 |
| ⑤ | `DEPRESSED` | 우울 (PHQ-2 근사 3점 이상) | Q3 + Q4 |
| ⑥ | `ACTIVITY_LIMIT` | 건강으로 인한 활동 제약 | Q7 |
| ⑦ | `BURNOUT` | 소진 경험 | Q5 |
| ⑧ | `LOW_INCOME` | 저소득 | Q8 |
| ⑨ | `DEBT` | 개인부채 | Q9 |
| ⑩ | `COLLEGE` | 대학 진학 | Q11 |
| ⑪ | `JOBLESS` | 미취업 (실업자 또는 비경제활동자) | Q10 |
| ⑫ | `AFTERCARE` | 자립준비 (보호종료) | Q11 |
| ⑬ | `MIGRANT` | 지역 이주 | Q11 |
| ⑭ | `CAREGIVER` | 가족 돌봄 (주 돌봄자) | Q12 |

⑩ `COLLEGE`는 판정에 쓰지 않는다. 관리자 통계·발표 자료용으로만 저장한다.

### 파생 점수

```
health = ③ + ④ + ⑤ + ⑥ + ⑦        (0~5)
econ   = ② + ⑧ + ⑨ + ⑪            (0~4)
```

`DEPRESSED`는 Q3·Q4의 PHQ 점수 합이 **3 이상**일 때 켜진다. PHQ-2의 표준 컷오프다.

---

## 5. 문항 스펙 (확정)

12문항 + 형용사 문항 1개. 실제로 사용자가 보는 것은 조기 종료 때문에 더 적다. 시나리오 20개 실측 **평균 9.7개, 최대 13개**(8장).

**문장 기준.** 소득·고립·우울을 그대로 묻지 않는다. 아래는 금지 예시다.

- ✗ "현재 소득은 어느 정도인가요?" / ✗ "지난 30일간 집 밖에 나간 적이 없나요?" / ✗ "우울증 진단을 받았나요?"

### Q1 — 지금 집 현관을 열면, 누가 있나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q1_FAMILY` | 가족이 있어요 | — |
| `Q1_ALONE` | 저 혼자예요 | ① |
| `Q1_SHARE` | 친구나 룸메이트가 있어요 | ① |
| `Q1_OTHER` | 그 외예요 | ① |

비가족 동거는 1인 가구 계열로 취급한다.

### Q2 — 지금 사는 곳을 떠올리면 마음이 어떤가요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q2_RISK` | 다음 달에도 여기 있을 수 있을지 모르겠어요 | ② |
| `Q2_BILL` | 고지서나 월세 날짜가 마음에 걸려요 | ② |
| `Q2_TIGHT` | 좁지만 지낼 만해요 | — |
| `Q2_SAFE` | 여기 있으면 마음이 놓여요 | — |

### Q3 — 예전에 좋아했던 것들은 요즘 어떤가요? (PHQ)

| 선택지 코드 | 표시 문구 | PHQ |
|---|---|---|
| `Q3_NONE` | 뭘 해도 재미가 없어요 | 2 |
| `Q3_LESS` | 예전만큼은 아니에요 | 1 |
| `Q3_MIXED` | 그때그때 달라요 | 1 |
| `Q3_SAME` | 여전히 좋아요 | 0 |

### Q4 — 아침에 눈을 떴을 때 하루가 어떻게 느껴지나요? (PHQ)

| 선택지 코드 | 표시 문구 | PHQ |
|---|---|---|
| `Q4_HEAVY` | 다시 눈을 감고 싶어요 | 2 |
| `Q4_DRAG` | 무겁지만 일단 일어나요 | 1 |
| `Q4_FLAT` | 특별한 느낌이 없어요 | 1 |
| `Q4_OK` | 대체로 괜찮아요 | 0 |

### Q5 — 쉬고 난 다음 날, 몸과 마음이 돌아오나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q5_EMPTY` | 자도 자도 바닥이에요 | ⑦ |
| `Q5_HALF` | 절반쯤만 돌아와요 | ⑦ |
| `Q5_MOST` | 대체로 돌아와요 | — |
| `Q5_FULL` | 잘 돌아와요 | — |

### Q6 — 가봐야 하는데 못 간 곳이 있나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q6_MENTAL` | 마음을 털어놓을 곳을 못 찾았어요 | ③ |
| `Q6_BODY` | 몸이 안 좋은데 병원을 못 갔어요 | ④ |
| `Q6_BOTH` | 둘 다 미루고 있어요 | ③ ④ |
| `Q6_NONE` | 지금은 없어요 | — |

### Q7 — 몸 상태 때문에 하려던 일을 접은 적이 있나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q7_OFTEN` | 자주 그래요 | ⑥ |
| `Q7_SOME` | 가끔 그래요 | — |
| `Q7_RARE` | 거의 없어요 | — |
| `Q7_NONE` | 없어요 | — |

`Q7_SOME`은 지표를 켜지 않는다. "가끔"까지 활동 제약으로 잡으면 `health`가 과대해져 건강·정서취약형 비율이 논문의 12%를 크게 넘는다.

### Q8 — 이번 달 통장을 볼 때 마음이 어떤가요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q8_FEAR` | 월말이 오는 게 겁나요 | ⑧ |
| `Q8_JUST` | 아끼면 겨우 맞아요 | ⑧ |
| `Q8_FINE` | 크게 신경 쓰지 않아요 | — |
| `Q8_ROOM` | 여유가 좀 있어요 | — |

### Q9 — 갚아야 할 것이 마음에 걸리나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q9_HEAVY` | 생각하면 잠이 안 와요 | ⑨ |
| `Q9_SOME` | 조금 있어요 | ⑨ |
| `Q9_UNSURE` | 생각하고 싶지 않아요 | ⑨ |
| `Q9_NONE` | 없어요 | — |

`Q9_UNSURE`도 ⑨를 켠다. 회피는 부채 없음보다 부채 있음에 가깝고, 잘못 켰을 때 피해가 작은 방향이다(경제 미션이 배정될 뿐이다).

### Q10 — 요즘 하루는 어떻게 채워지나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q10_EMPTY` | 딱히 정해진 게 없어요 | ⑪ |
| `Q10_SEEK` | 일자리를 찾아보고 있어요 | ⑪ |
| `Q10_SHORT` | 짧게라도 일하고 있어요 | — |
| `Q10_FIXED` | 정해진 곳에 나가요 | — |

### Q11 — 스무 살 무렵, 어디에서 나와 지금까지 왔나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q11_COLLEGE` | 대학을 다니다 왔어요 | ⑩ |
| `Q11_AFTERCARE` | 시설이나 위탁가정에서 나왔어요 | ⑫ |
| `Q11_MIGRANT` | 살던 지역을 떠나 혼자 왔어요 | ⑬ |
| `Q11_STAY` | 쭉 살던 곳에 있어요 | — |

한 문항이 ⑩⑫⑬을 나눠 잡는다. 세 사건이 동시에 해당되는 경우를 포기하는 대신 문항 2개를 아꼈다. 세부유형 판정에는 충분하다.

### Q12 — 집에서 당신이 챙겨야 하는 사람이 있나요?

| 선택지 코드 | 표시 문구 | 켜는 지표 |
|---|---|---|
| `Q12_MAIN` | 제가 없으면 안 되는 사람이 있어요 | ⑭ |
| `Q12_HELP` | 조금 거들어요 | — |
| `Q12_NONE` | 없어요 | — |

가족돌봄청년은 주 돌봄자를 말한다. `Q12_HELP`는 켜지 않는다.

### Q13 — 어떤 때가 가장 편한가요? (형용사, 지표 없음)

`SPEC.md` 2절에 문구가 고정되어 있다.

| 선택지 코드 | 표시 문구 | 형용사 |
|---|---|---|
| `Q13_NIGHT_ALONE` | 밤에 혼자 있는 시간이 가장 편해요 | 조용한 |
| `Q13_WITH_CLOSE` | 마음 맞는 사람과 있을 때가 편해요 | 다정한 |
| `Q13_ON_PLAN` | 계획대로 하루가 굴러가면 편해요 | 부지런한 |
| `Q13_NO_RUSH` | 서두르지 않고 흐르는 대로가 편해요 | 느긋한 |

Q13은 조기 종료 대상이 아니다. 형용사가 없으면 닉네임을 만들 수 없으므로 **항상 마지막에 묻는다.**

---

## 6. 대분류 판정 규칙 (확정)

사용자에게 보이는 3유형이다. **유형 이름은 화면에 절대 쓰지 않는다.** 동물과 종족만 보여준다.

| `TypeCode` | 동물 | 종족 | 색 | 논문 비율 |
|---|---|---|---|---|
| `HEALTH_EMOTION` | 여우 | 개과 | `#E8956A` 노을 주황 | 12.13% |
| `INDEPENDENT_LOW_INCOME` | 고양이 | 고양잇과 | `#6A95C8` 새벽 파랑 | 16.75% |
| `FAMILY_LIVING` | 곰 | 곰과 | `#7AAE82` 이끼 초록 | 71.12% |

색은 `lib/types.ts`의 `TRIBE`와 `styles/tokens.css`의 `[data-tribe]` 두 곳에 있다 — 한쪽만 고치지 않는다(12장). **컬러명은 첫 `npm run db:seed` 전에 확정했다.** `prisma/seed/items.ts`의 upsert가 아이템 `name`을 유니크 키로 쓰므로, 시드를 돌린 뒤 이름을 바꾸면 옛 행이 남고 새 행이 추가된다.

```
1. health >= 3                        → HEALTH_EMOTION
2. !ALONE                             → FAMILY_LIVING
3. health >= 2 && health >= econ      → HEALTH_EMOTION
4. 그 외                               → INDEPENDENT_LOW_INCOME
```

위에서부터 평가하고 처음 걸리는 곳에서 멈춘다. 네 가지를 명시한다.

- **규칙 1이 가족 동거보다 앞이다.** 가족과 살아도 건강 지표 5개 중 3개가 켜졌으면 건강·정서취약형이다. 이전 버전은 Q1 하나로 가족 동거를 확정했는데, 그러면 가족과 사는 심한 우울 사용자가 가장 낮은 강도의 미션을 못 받는다
- **동점(`health === econ`)이면 `HEALTH_EMOTION`이다.** 건강·정서 문제는 방치했을 때 위험이 크고, 이 유형의 미션이 더 낮은 강도에서 시작하므로 잘못 판정했을 때 피해가 적다
- **지표가 전부 꺼지면 `ALONE` 여부로 갈린다.** 가족과 살면 곰, 아니면 고양이다. 1인 가구 자체가 독립거주형의 핵심 특성(92%)이다
- `econ`은 규칙 3의 비교에만 쓴다. 단독으로 유형을 결정하는 분기를 추가하지 않는다

---

## 7. 세부유형 판정 규칙 (확정)

관리자 전용이다. 8개. **화면에 이 이름을 노출하지 않는다.**

```
1. AFTERCARE                                       → AFTERCARE_YOUTH      자립준비청년
2. CAREGIVER                                       → FAMILY_CAREGIVER     가족돌봄청년
3. MIGRANT                                         → MIGRANT_YOUTH        지역이주청년
4. health >= 3                                     → HEALTH_FRAGILE       건강취약형
5. ALONE && DEBT && (LOW_INCOME || HOUSING_UNSTABLE) → DEBT_INDEPENDENT    독립생계채무형
6. DEBT && (LOW_INCOME || HOUSING_UNSTABLE)         → FINANCIAL_FRAGILE    금융취약청년
7. JOBLESS && LOW_INCOME                           → JOBLESS_POOR         미취업빈곤형
8. 그 외                                            → FAMILY_DEPENDENT     가족의존형
```

- **사실 유형(⑫⑬⑭)을 맨 앞에 둔다.** 자립준비청년·가족돌봄청년은 외부 지원 제도가 따로 있어서, 관리자가 연계할 때 이 사실이 다른 취약성보다 먼저다
- 규칙 5와 6은 `ALONE`으로만 갈린다. 혼자 살면서 빚이 있는 쪽이 독립생계채무형이다
- 기본값이 `FAMILY_DEPENDENT`인 이유는 이 집단이 논문에서 가장 크고(71%), 아무 지표도 켜지지 않은 사용자가 실제로 여기에 가깝기 때문이다

대분류와 세부유형은 **서로를 참조하지 않는다.** 둘 다 지표만 본다. 관리자 화면은 교차표로 본다.

---

## 8. 무손실 조기 종료 (확정)

`lib/diagnosis/adaptive.ts`

지표가 monotone하므로 미답 문항이 만들 수 있는 `(ALONE, health, econ)` 조합을 전부 열거해도 상태가 60개를 넘지 않는다. 그래서 **가능한 유형 집합을 정확히 계산한다.** 근사·휴리스틱이 아니다.

```ts
export function possibleTypes(answers: Answer[]): TypeCode[]
export function canDecide(answers: Answer[]): boolean          // possibleTypes().length === 1
export function nextQuestion(answers: Answer[]): Question | null
```

- `nextQuestion()`은 미답 문항 중 **최악의 경우 남는 유형 수가 가장 적은** 문항을 고른다. 동점이면 문항 번호 순. 결정적이다
- 대분류가 확정되면 남은 대분류 문항(Q1~Q10)을 건너뛴다
- **Q11·Q12·Q13은 확정 후에도 반드시 묻는다** (`TAIL_QUESTION_CODES`). Q11·Q12는 대분류에 전혀 영향이 없지만 세부유형 8개 중 3개(자립준비·가족돌봄·지역이주)가 여기에만 달려 있어서, 건너뛰면 관리자 통계에서 그 3개가 사라진다. Q13은 없으면 닉네임을 만들 수 없다
- Q13에 답하면 `nextQuestion()`은 `null`을 반환한다. 그때 완료 API를 호출한다

**실측 문항 수.** 시나리오 20개를 실제 화면 흐름대로 돌린 결과 평균 9.7개, 최대 13개다. 13문항 전부를 묻는 경우도 있다(대분류 신호가 어중간하면 Q1~Q10을 다 봐야 갈린다). 3개는 항상 묻는 꼬리 문항이므로 조기 종료가 줄이는 것은 Q1~Q10 중 평균 3.3개다. 이 숫자는 `npm run check:diagnosis`가 매번 출력한다.

**정확도 손실이 0인 근거:** 조기 종료로 얻은 결과는 미답 문항을 어떻게 채워도 같은 유형이 나올 때만 확정된다. 9장에서 시나리오마다 "전체 문항 결과 == 조기 종료 결과"를 단정한다.

단, 조기 종료는 **대분류만** 무손실이다. 세부유형은 답하지 않은 Q1~Q10의 지표를 `false`로 두고 계산하므로, 조기 종료한 사용자의 세부유형은 정확도가 떨어진다(건강취약형·독립생계채무형 등이 과소 집계된다). 관리자 통계용이므로 받아들인다. **이 사실을 교차표 화면에 명시한다.**

---

## 9. 스냅샷 시나리오 (확정)

`scripts/check-diagnosis.ts`. **기대값은 손으로 확정한 것이다. 구현 결과에 맞춰 기대값을 고치지 않는다.**

각 행은 12문항 전부에 답한 경우다. Q13은 형용사만 결정하므로 표에서 뺐다.

| # | 답변 (문항: 선택지 접미사) | health | econ | 대분류 | 세부유형 | 검증 목적 |
|---|---|---|---|---|---|---|
| A1 | Q1 FAMILY, Q11 AFTERCARE, 나머지 무신호 | 0 | 0 | FAMILY_LIVING | AFTERCARE_YOUTH | 사실 유형이 최우선 |
| A2 | Q1 ALONE, Q11 AFTERCARE, Q8 FEAR, Q9 HEAVY | 0 | 2 | INDEPENDENT_LOW_INCOME | AFTERCARE_YOUTH | 자립준비가 채무보다 앞 |
| C1 | Q1 FAMILY, Q12 MAIN, 나머지 무신호 | 0 | 0 | FAMILY_LIVING | FAMILY_CAREGIVER | 돌봄 |
| C2 | Q1 FAMILY, Q12 MAIN, Q3 NONE, Q4 HEAVY, Q5 EMPTY, Q6 BOTH | 4 | 0 | HEALTH_EMOTION | FAMILY_CAREGIVER | 대분류·세부가 독립임을 보이는 행 |
| M1 | Q1 ALONE, Q11 MIGRANT, Q8 JUST | 0 | 1 | INDEPENDENT_LOW_INCOME | MIGRANT_YOUTH | 이주 |
| H1 | Q1 ALONE, Q3 NONE, Q4 HEAVY, Q6 BOTH, Q5 EMPTY, Q7 OFTEN | 5 | 0 | HEALTH_EMOTION | HEALTH_FRAGILE | 건강 최대 |
| H2 | Q1 FAMILY, Q3 NONE, Q4 HEAVY, Q5 EMPTY, Q7 SOME | 2 | 0 | FAMILY_LIVING | FAMILY_DEPENDENT | **health 2는 규칙 1 미달. 가족이 이긴다** |
| H3 | Q1 FAMILY, Q3 NONE, Q4 HEAVY, Q5 EMPTY, Q7 OFTEN | 3 | 0 | HEALTH_EMOTION | HEALTH_FRAGILE | **health 3에서 가족을 이긴다. H2와 경계쌍** |
| H4 | Q1 ALONE, Q3 LESS, Q4 DRAG, Q5 HALF, Q8 FEAR, Q9 HEAVY, Q10 EMPTY | 1 | 3 | INDEPENDENT_LOW_INCOME | DEBT_INDEPENDENT | PHQ 2점은 우울 미달 |
| H5 | Q1 ALONE, Q3 NONE, Q4 DRAG, Q5 HALF | 2 | 0 | HEALTH_EMOTION | FAMILY_DEPENDENT | **PHQ 3점에서 우울이 켜진다. H4와 경계쌍** |
| H6 | Q1 ALONE, Q3 NONE, Q4 HEAVY, Q6 MENTAL, Q8 FEAR, Q9 HEAVY | 2 | 2 | HEALTH_EMOTION | DEBT_INDEPENDENT | **동점은 HEALTH** |
| I1 | Q1 ALONE, Q3 NONE, Q4 HEAVY, Q6 MENTAL, Q8 FEAR, Q9 HEAVY, Q10 EMPTY | 2 | 3 | INDEPENDENT_LOW_INCOME | DEBT_INDEPENDENT | **econ이 1 크면 뒤집힌다. H6과 경계쌍** |
| I2 | Q1 ALONE, Q8 FEAR, Q9 HEAVY, Q2 RISK, Q10 EMPTY | 0 | 4 | INDEPENDENT_LOW_INCOME | DEBT_INDEPENDENT | 경제 최대 |
| I3 | Q1 ALONE, 전부 무신호 | 0 | 0 | INDEPENDENT_LOW_INCOME | FAMILY_DEPENDENT | **전부 0 + 혼자 → 고양이** |
| F1 | Q1 FAMILY, 전부 무신호 | 0 | 0 | FAMILY_LIVING | FAMILY_DEPENDENT | **전부 0 + 가족 → 곰** |
| F2 | Q1 FAMILY, Q8 FEAR, Q9 HEAVY | 0 | 2 | FAMILY_LIVING | FINANCIAL_FRAGILE | 동거 + 빚 → 금융취약 |
| F3 | Q1 FAMILY, Q8 FEAR, Q10 EMPTY | 0 | 2 | FAMILY_LIVING | JOBLESS_POOR | 빚 없이 미취업 + 저소득 |
| F4 | Q1 FAMILY, Q10 EMPTY | 0 | 1 | FAMILY_LIVING | FAMILY_DEPENDENT | 미취업만이면 기본값 |
| J1 | Q1 ALONE, Q10 EMPTY, Q8 FEAR | 0 | 2 | INDEPENDENT_LOW_INCOME | JOBLESS_POOR | 혼자 + 미취업빈곤 |
| B1 | Q1 SHARE, Q7 SOME, Q5 MOST, Q3 MIXED, Q4 FLAT, Q12 HELP | 0 | 0 | INDEPENDENT_LOW_INCOME | FAMILY_DEPENDENT | **중간 답변은 지표를 켜지 않는다. 비가족 동거는 1인 가구 계열** |

경계쌍 3개를 명시한다. 이 쌍이 규칙의 임계값을 고정한다.

- **H2 / H3** — Q7만 다르다(`SOME` → `OFTEN`). `health` 3이 가족 동거를 이기는 지점
- **H4 / H5** — Q3만 다르다(`LESS` → `NONE`). PHQ 3점이 우울을 켜는 지점
- **H6 / I1** — Q10만 다르다(무응답 → `EMPTY`). `econ`이 `health`를 넘는 지점

### 조기 종료 검증

시나리오 20개 전부에 대해 아래를 단정한다.

1. 답변을 하나씩 누적하며 `canDecide()`가 처음 true가 된 시점의 `classify()` 결과 == 12문항 전체의 `classify()` 결과
2. `possibleTypes()`의 길이는 답변이 늘어날 때 절대 증가하지 않는다
3. 답변 0개일 때 `possibleTypes()`는 3개 전부를 반환한다

### 이상 입력

모두 throw한다.

1. 존재하지 않는 `choiceCode`
2. 같은 `questionCode`가 두 번
3. `questionCode`와 `choiceCode`가 어긋난 경우 — 조작으로 간주해 거부한다
4. Q13(형용사) 누락 상태로 `classify()` 호출

지표 문항은 일부만 와도 된다(조기 종료 때문이다). **Q13은 반드시 있어야 한다.**

### 신뢰 경계 — 중요

**서버는 `choiceCode`만 신뢰하고, 지표는 서버의 문항 테이블에서 조회한다.** 클라이언트가 보낸 지표를 그대로 쓰면 사용자가 요청을 조작해 원하는 유형을 만들 수 있다.

---

## 10. 화면·API 계약

### 화면

`app/diagnosis/page.tsx` **한 장**으로 만든다. 문항별 라우트를 만들지 않는다.

- 진행 상태는 클라이언트 컴포넌트 state에 둔다
- 다음 문항은 `nextQuestion(answers)`로 정한다. 문항마다 서버를 부르지 않는다
- 진행률은 문항 수로 계산하지 않는다(조기 종료 때문에 총 문항 수가 사용자마다 다르다). `3 - possibleTypes().length`를 쓰거나 "거의 다 왔어요" 같은 문구로 대체한다
- `nextQuestion()`이 `null`이면 완료 API를 한 번 호출한다
- 결과는 `app/diagnosis/result/page.tsx`

### `POST /api/diagnosis/complete`

```ts
// 요청
{ answers: [{ questionCode: "Q1", choiceCode: "Q1_ALONE" }, ...] }

// 성공
{ data: { typeCode, adjective, nickname, family, animal, colorHex } }
```

응답에 `subTypeCode`와 지표를 넣지 않는다. 클라이언트가 알 필요가 없고, 내부 유형명이 브라우저로 나가면 낙인 위험이 생긴다.

처리 순서:

1. `const user = await getCurrentUser()`
2. `classify(answers)` — 실패 시 `fail("INVALID_ANSWER", "진단 답변이 올바르지 않습니다", 400)`
3. `classifySub(answers)`, `resolveIndicators(answers)`
4. `defaultNickname(typeCode, adjective)`로 닉네임 생성
5. `User` 갱신 — `typeCode`, `subTypeCode`, `adjective`, `nickname`, `activePetSkinId`. **레벨·경험치·재화·아이템·streak은 건드리지 않는다** (재진단에서 같은 코드가 돌기 때문이다)
6. 기본 펫 지정 — `prisma.petSkin.findFirst({ where: { typeCode, isDefault: true } })`의 id를 `activePetSkinId`에 넣고, `UserPetSkin`을 `upsert`로 보유 처리한다
7. `DiagnosisSession` 생성 — `answers`와 `indicators` 저장
8. 5·6·7을 하나의 `prisma.$transaction`으로 묶는다

**재진단은 이 엔드포인트를 그대로 다시 호출한다.** `DiagnosisSession`은 매번 새 행이 쌓이므로 이력이 남는다. 4의 닉네임은 저장된 값이 이전 기본 닉네임과 같을 때만 새로 만든다(2장).

### `GET /api/diagnosis/me`

```ts
{ data: { typeCode, adjective, nickname, family, animal, colorHex } }   // 진단 전이면 data: null
```

완료 API와 같은 모양이다. 결과 화면과 홈이 새로고침·직접 진입을 견디게 하는 유일한 통로다. 401은 화면에서 `null`로 취급해 시작 화면을 보여준다.

### `PATCH /api/diagnosis/nickname`

```ts
{ nickname: "밤바다" }  →  { data: { nickname } }
```

`isValidNickname()`으로 검증한다(2~12자). 실패 시 `fail("INVALID_NICKNAME", "닉네임은 2~12자로 입력해 주세요", 400)`.

### 스키마 변경 요청분 (`feat/diagnosis` 브랜치)

`prisma/schema.prisma`는 전원 합의 파일이다. 아래를 브랜치에 담아 PR로 올린다.

```prisma
enum SubTypeCode {
  AFTERCARE_YOUTH
  FAMILY_CAREGIVER
  MIGRANT_YOUTH
  HEALTH_FRAGILE
  DEBT_INDEPENDENT
  FINANCIAL_FRAGILE
  JOBLESS_POOR
  FAMILY_DEPENDENT
}

model User {
  subTypeCode SubTypeCode?   // 관리자 전용. 화면에 노출하지 않는다
}

model DiagnosisSession {
  subTypeCode SubTypeCode?
  indicators  Json?          // 지표 14개
}
```

---

## 11. 미션 콘텐츠 스펙 (확정)

### 개수와 코드

- 단계 미션은 유형당 12개 = 3단계 × 4개. 총 36개
- `code` 규칙: `{TYPE_CODE}_S{단계}_{1~4}`
- `order`는 단계 안에서 1~4
- `typeCode`와 `stage`를 반드시 채운다 (`scope: "STAGE"`)

### 보상 (고정값)

| 단계 | `rewardSeeds` | `rewardShards` | `requiresPhoto` |
|---|---|---|---|
| 1단계 | 20 | 0 | false |
| 2단계 | 35 | 0 | false |
| 3단계 | 60 | 5 | 4개 중 2개만 true |

보상은 바뀔 수 있다. `prisma/seed/missions.ts`의 `SEEDS_BY_STAGE` 3개 숫자만 고치고 `npm run db:seed`를 다시 돌리면 된다(`code` upsert).

`rewardAffinity`는 단계 미션에 넣지 않는다.

### 단계 설계

- 1단계: 집 안에서, 침대에서 손만 움직여도 되는 수준
- 2단계: 집 주변으로 나가는 것
- 3단계: 사람과 접촉하는 것

### 문구 기준

- 명령·강요 표현을 쓰지 않는다. "~하세요"보다 "~해봐요", "~해도 좋아요"
- 실패해도 부담이 없게 쓴다. "1분만", "안 되면 내일 해도 괜찮아요"
- `title`은 12자 이내, `description`은 한 문장
- 유형별로 결이 달라야 한다
  - `HEALTH_EMOTION` (여우): 몸과 기분 회복이 먼저. 강도를 가장 낮게
  - `INDEPENDENT_LOW_INCOME` (고양이): 혼자 사는 생활 관리, 지출·일 관련 부담이 낮은 것
  - `FAMILY_LIVING` (곰): 가족과의 접촉이 자연스러운 소재

---

## 12. 화면 디자인 (확정)

기준 문서는 프로젝트 루트의 `design.md`다. 여기에는 왜 그렇게 정했는지만 적는다.

**값과 구성 모두 Figma 프로토타입에서 가져왔다** (`isol-design_Figma/README.md`
"디자인 규칙" 절). 1차로 색·폰트 값을, 2차로 화면 구성을 옮겼다. 옮긴 것과 옮기지 않은 것:

| 가져온 것 | 가져오지 않은 것 |
|---|---|
| 팔레트 hex 전부(배경·카드·주색·강조·테두리) | 고정 6문항과 "질문 n / 6" 카운터 |
| Gowun Dodum + Noto Sans KR | 종족명(여우족/고양잇과/곰족) |
| 카드 모서리 20px, 입력 12px | 결과 화면의 종족 특성 설명 |
| `fadeSlideIn`·`float`·`bounceIn`, `.card-hover` 그림자 | 인라인 style 객체 방식 |
| 포커스 링 3px `#1F4D33`, 44px 터치 하한 | localStorage 인증, 직접 `seeds` 증감 |
| `#EDE5D0` 판 + 카드 구성, `auto-fit` 2열 격자 | 씨앗·친밀도·출석 통계 카드(데이터 없음) |
| 진행률 바, 선택지 A·B·C 글자, 2열 선택지 | 닉네임 변경 모달(결과 화면 입력으로 대신함) |
| 인트로 구성(왼쪽 글·오른쪽 안내 카드·종족 3종) | 사이드바·하단 탭(E의 `layout.tsx` 소유) |
| 결과 2열 구성, "이렇게 함께해요" 체크 목록 | 펫 레벨·경험치 바(C 담당 + DB 대기) |

- **종족색을 Figma 값으로 교체했다.** 여우 `#E8956A` / 고양이 `#6A95C8` / 곰 `#7AAE82`.
  이전 값(`#F59E0B`/`#38BDF8`/`#34D399`)은 종이색 배경 `#F5F0E8` 위에서 형광으로 뜨고,
  초록이 주색 `#4B7A5B`와 부딪혔다. 색 이름도 함께 바꿨다(노을 주황·새벽 파랑·이끼 초록).
  값은 `lib/types.ts`와 `styles/tokens.css` 두 곳에 있다 — **한쪽만 고치면 안 된다**
- **hex를 OKLCH로 변환하지 않았다.** Figma README가 `#7A6B58`·`#A9542A`를 명암비 때문에
  조정한 값이라고 못 박아 뒀다. 변환하면 두 문서의 값이 갈라지고 그 근거가 사라진다
- **제목 굵기를 700에서 400으로 내렸다.** Gowun Dodum은 굵기가 하나뿐이라 700을 주면
  브라우저가 합성 볼드를 만들어 글자가 흐려진다. Noto Sans KR에는 600이 없어 라벨은 700이다
- **마스코트를 이모지로 넣었다**(`TRIBE[].emoji`). 이전에는 원판에 "여우" 같은 글자가 들어
  있었다. 펫 이미지가 오면 이모지만 이미지로 바뀐다. 장식이라 `aria-hidden="true"`고,
  종족명은 옆에 글자로 따로 있다
- **hover에 그림자와 1px 들림을 허용했다**(Figma `.card-hover`). `prefers-reduced-motion`에서
  죽는다. 반복 애니메이션인 `.hm-float`는 그 조건에서 시간을 줄이지 않고 아예 끈다 —
  줄이면 빠르게 깜빡여 더 나쁘다
- 홈에 시간대 인사말을 넣었다(Figma 홈 상단). `new Date()`를 렌더 중에 쓰면 서버·브라우저
  시각이 달라 hydration 경고가 나므로 `useEffect` 안에서만 계산한다
- **진행률 바를 넣되 값을 다르게 계산한다.** Figma는 `(현재 문항 + 1) / 6`이다. 우리는 총 문항
  수를 노출할 수 없어서(3절) "유형이 좁혀진 정도"를 쓴다. 앞 구간은 후보가 3 → 1로 줄어든
  비율의 60% + 답한 개수 × 4%, 45%에서 자른다. 뒤 구간은 꼬리 문항 3개가 답해진 비율로
  50 → 100%. 좁혀진 정도만 쓰면 후보가 3 → 2에 머무는 동안 바가 멈춰 보여서 답한 개수를 섞었다.
  답을 되돌리지 않는 한 줄어들지 않는다
- **화면 폭을 Figma에 맞춰 넓혔다.** 진단 42.5rem(680px) · 결과·홈 52.5rem(840px) ·
  시작 56.25rem(900px). `--col-max`를 화면 클래스가 정하고 `.hm__col`이 읽는다.
  넓은 화면에서 두 열, 좁은 화면에서 한 열이다
- **홈 미션 미리보기는 `prisma/seed/missions.ts`의 `DAILY`를 직접 읽는다.** 문구를 화면에
  복사하면 시드와 갈라진다. 그 파일의 `@prisma/client` import는 타입뿐이라 클라이언트
  번들에 Prisma가 들어가지 않는다. 완료 여부 표시는 DB가 붙은 뒤에 넣는다
- **Figma 홈의 통계 카드·출석 캘린더·경험치 바는 가져오지 않았다.** 씨앗·친밀도·출석·레벨
  데이터가 아직 없다. 0이나 "—"로 채운 카드는 화면을 채우는 대신 "여기는 고장났다"를 보여준다.
  데이터가 생기면 `.hm-card`·`.hm-tiles`가 그 자리를 그대로 받는다
- CTA는 Figma의 12px 사각 버튼이 아니라 pill을 유지했다. 세 화면의 CTA가 같은 모양이어야
  학습이 된다(`design.md` CTA voice)

- **공유 파일을 건드리지 않기 위해 `styles/tokens.css`를 따로 만들었다.** Hallmark 방식대로 하면 전역 CSS와 `layout.tsx`에 폰트·토큰을 넣어야 하는데 둘 다 E 소유다. 대신 각 화면이 `import "@/styles/tokens.css"`로 직접 불러오고, 기본 스타일은 각 화면 `<main className="hm">` 아래로만 적용한다. E의 `globals.css`는 그대로 살아 있다
- **폰트는 CSS `@import`로 불러온다.** `next/font`를 쓰면 `layout.tsx`를 고쳐야 하고, 새 npm 의존성은 `CLAUDE.md`가 금지한다. Gowun Dodum(제목) + Noto Sans KR(본문) 2종만 쓴다
- **색은 종이색 계열 + 낮은 채도의 점토색 강조 하나.** 고립은둔 상태에서 쓰는 화면이라 형광·고채도·검정 배경을 피했다. 순수 흑백은 쓰지 않고 전부 따뜻한 쪽으로 살짝 틀어 둔다
- **종족색은 `data-tribe` 속성으로만 넣는다.** 이전에는 `style={{ backgroundColor: tribe.colorHex }}`였다. 인라인 hex를 쓰면 색이 `lib/types.ts`와 CSS 두 곳에 흩어지고, 다크 모드나 색 교체 때 한 곳만 바뀐다. `[data-tribe="..."]`가 `--tribe`를 덮어쓰는 구조라 `lib/types.ts`는 손대지 않았다
- **채도 높은 면적을 좁게 묶었다.** 종족판은 종이색에 종족색을 22%만 섞고, 진한 색은 원판 하나로 제한한다(결과 7.5rem, 홈은 원판 없이 이모지 마스코트). 진단 전 시작 화면만 예외로 세 종족 타일을 나란히 둔다 — 아직 내 종족이 없어서 강조할 색도 없다
- **움직임은 다섯 가지만 쓴다.** 등장 페이드(`.hm-fade`), 마스코트 상하(`.hm-float`), 결과 마스코트 등장(`.hm-bounce`, scale을 쓰는 유일한 자리), 버튼 누름(`translateY(1px)`), 카드 hover 들림(`-1px`). `prefers-reduced-motion`에서 150ms로 줄이고 이동은 없애고 `.hm-float`는 끈다 — 반복 애니메이션은 짧게 줄이면 오히려 깜빡인다
- **닉네임 오류는 `blur` 이후에만 띄운다.** 지우는 중에 빨간 글씨가 따라오면 압박이 된다. 오류는 테두리색·글리프(`!`)·문장·`aria-invalid` 네 가지로 알린다. 색만으로 알리지 않는다
- **도움말과 오류가 같은 자리를 쓴다**(`min-height: 1lh`). 오류가 떠도 아래 버튼이 밀리지 않는다
- 입력창과 버튼 높이를 44px로 맞췄다(`--control-h`). 테두리는 어떤 상태에서도 1px이고 포커스 링 자리를 `outline: 2px solid transparent`로 미리 비워둔다. 상태가 바뀔 때 레이아웃이 흔들리지 않는다
- 진행 표시는 여전히 "n/13"을 쓰지 않는다. 진행률 바 + 퍼센트만 쓰고, 값은 총 문항 수가 아니라 "유형이 좁혀진 정도"다
- 다크 모드는 만들지 않았다. 명세에 없다

**진단 선택지 라벨은 두 줄 이상으로 감긴다.** 선택지가 문장이라 줄일 수 없다. CTA·링크·홈 메뉴 라벨은 전부 한 줄로 고정했다.

검증: 320·375·768px에서 가로 스크롤 없음, 터치 영역 44px 이상, 측정한 색 대비쌍 전부 통과
(입력 테두리 `#8F8069`/`#F5F0E8` 3.39:1, 보조 텍스트·강조 4.5:1 이상).

**브라우저 확인은 3101 포트의 프로덕션 서버로 했다.** 다른 세션이 3000 포트의 dev 서버를
잡고 있고 Next는 같은 폴더에서 dev 서버 두 개를 띄우지 못한다. 그래서 `.claude/launch.json`에
`next start -p 3101`을 쓰는 `prod` 항목을 넣었다. 코드를 고칠 때마다 `npm run build` 후
서버를 다시 띄워야 한다 — `next start`는 캐시된 빌드를 내보낸다.

확인한 것: 시작·진단·결과·홈 네 화면을 375·760·1280px에서 봤다. 시작 화면은 375에서 1열,
1280에서 2열로 접힌다. 진단 화면은 바 + A·B·C·D 선택지가 375에서 1열, 760에서 2열이다.
결과 화면은 2열로 "개과 · 여우"와 "고양잇과 · 고양이"를 각각 확인했다. 홈은 인사말·이름·배지·
마스코트·펫 카드·미션 타일 4개·커뮤니티 행이 모두 나온다. 콘솔 로그 없음,
375px에서 `scrollWidth == clientWidth == 375`. `npm run build`·`npm run check:diagnosis` 통과.

---

## 13. 다음 할 일

### 다른 사람에게 넘길 것 — 남은 것

**E — 하단 탭 제거 + 사이드바 단일.** 사용자 결정이다(2장). `app/layout.tsx`에서 `BottomNav`를 빼고 사이드바 하나만 남긴다. 모바일은 아이콘만 남긴 좁은 레일, 진단 문항 화면(`/diagnosis`)에서는 내비를 숨긴다. 적용됐다고 알려주면 A가 `styles/tokens.css`의 `--nav-h`를 지운다.

**E — Amplify ↔ GitHub 연동.** 브라우저 수동 단계라 계정 소유자만 할 수 있다.

**D — 중복 init 마이그레이션.** `feat/community`의 `prisma/migrations/00000000000000_init/`을 지우고 `main`의 `20260819061857_init/`·`20260819080703_add_subtype/`을 받는다. **8/20 5인 머지 전에 처리해야 한다.** 그대로 머지되면 init이 두 개가 되어 `migrate deploy`가 깨진다.

**B — `GET /api/missions`.** 나오면 홈 미션 미리보기를 그쪽으로 바꾼다.

**C — 종족 외형 스킨 전환의 남은 코드 5곳 (2026-08-20 팀 합의).** 스키마·실 DB·시드는 A가 적용을 끝냈다. `app/api/pet/cosmetics/route.ts`, `app/api/pet/skins/route.ts`, `app/api/pet/skins/buy/route.ts`, `app/pet/_components/SkinList.tsx`, `scripts/check-pet.ts`가 남았고 전부 `feat/pet`에만 있는 파일이다. 상세와 충돌 목록은 15절에 있다. `main`을 받으면 스키마·시드·마이그레이션에서 충돌하며 **전부 `main` 쪽을 채택하면 된다.** A는 `app/api/diagnosis/complete/route.ts`의 기본 펫 지급 쿼리(`where: { typeCode, isDefault: true }`)를 그대로 두면 되므로 진단 쪽 변경은 없다.

**C — 재진단 시 옛 종족 스킨 정책.** `UserPetSkin`에 남는 옛 종족 스킨을 환불할지 유지할지 정해야 한다. 15절 "남는 문제" 참고. 지금 `UserPetSkin`이 1건뿐이라 정하기 가장 싼 시점이다.

### 넘겨서 끝난 것 (기록)

- E — 2차 마이그레이션 `20260819080703_add_subtype`: A가 넘긴 DDL 그대로 적용됐다
- C — `prisma/seed/items.ts` 동물 매핑·치장 이름: 실 DB에는 이미 확정 값이 들어가 있었고 `main`의 시드만 옛 값이었다. 2026-08-20에 스킨·치장 구조 변경과 함께 A가 맞췄다(15절)
- E — `lib/auth.ts` 지연 초기화: `getVerifier()`로 고쳐졌다
- E — `app/globals.css`의 종족색 3줄 삭제, `BottomNav`의 "진단결과" 경로 수정, `.env.example` DB 이름 `welli`

### A가 이어서 할 것

0. `feat/diagnosis` → `main` PR. 스키마·마이그레이션·시드가 들어 있어 5인 전원이 받아야 한다. 머지 후 전원에게 `git pull && npx prisma migrate deploy && npx prisma generate` 공지
1. 관리자 교차표 (대분류 × 세부유형)
2. 펫 이미지가 S3에 올라오면 홈·결과의 종족색 원판을 이미지로 교체 (C·E 대기). 자리와 크기는 `styles/tokens.css`의 `.hm-plate__disc`(결과 7.5rem·기본 4.5rem)와 `.hm-tile__face`가 잡아 뒀다
3. 다른 화면(미션·펫·커뮤니티)도 같은 결로 맞추려면 담당자에게 `design.md`와 `styles/tokens.css`를 알린다. 남의 폴더는 A가 고치지 않는다

---

## 14. 실 DB 검증 기록 (2026-08-19)

2차 마이그레이션이 적용된 뒤 처음으로 진단 전체 흐름을 실제 RDS에 붙여 확인했다. 그전까지는 `P2022`로 API 3종이 전부 500이었으므로, 이 기록이 "화면과 DB가 실제로 이어졌다"는 첫 증거다.

절차: `git merge origin/main` → `npx prisma migrate deploy`(적용할 것 없음 = 이미 최신) → `npx prisma generate` → `npm run build` → `next start -p 3101`.

확인한 것:

| 확인 | 결과 |
|---|---|
| `GET /api/diagnosis/me` (진단 전) | `{"data":null}` — 홈이 시작 화면을 띄운다 |
| `POST /api/diagnosis/complete` 조작된 답변 | `{"error":{"code":"INVALID_ANSWER","message":"진단 답변이 올바르지 않습니다"}}` 400 |
| 진단 12문항 응답 후 결과 화면 | `data-tribe="INDEPENDENT_LOW_INCOME"`, "🐱 고양잇과 · 고양이 / 새벽 파랑", 기본 닉네임 "다정한 고양이"가 입력창에 채워짐 |
| 닉네임을 "밤바다"로 바꾸고 시작하기 | `PATCH /api/diagnosis/nickname` 200, 홈으로 이동 |
| 홈 | "오늘 하루도 / 밤바다 / 🐱 고양잇과", 일일 미션 4개 표시 |

`npm run build`와 `npm run check:diagnosis` 모두 통과한다. 남은 것은 마스코트(펫 이미지 대기)와 미션 완료 여부 표시(B API 대기)뿐이다.

**빌드 캐시 주의.** `next start`는 캐시된 빌드를 내보낸다. 코드를 고쳤으면 `npm run build`를 다시 돌리고 서버를 재시작해야 화면에 반영된다.

---

## 15. 스킨·치장·가챠 구조 변경 — C에게 넘기는 확정안 (2026-08-20)

사용자 결정 4건을 한 번에 반영한다.

1. **스킨은 종족 전용이다.** 진단으로 정해진 동물은 고정이고, 상점에서 사는 것은 같은 동물의 변종 외형뿐이다. 여우는 북극여우·사막여우, 고양이는 샴고양이·페르시안고양이, 곰은 북극곰·반달가슴곰처럼 어미에 종족명이 붙는다. 능력치는 바뀌지 않고 **외형만** 바뀐다
2. **치장 아이템은 종족 구분을 없앤다.** 모든 치장 아이템을 종족과 무관하게 쓸 수 있다. 등급(`rarity`)은 유지한다
3. **화폐를 전용으로 갈라놓는다.** 스킨은 **별조각 전용**, 치장 아이템(옷·배경 등)은 **친밀도 전용**이다. 한 품목을 두 화폐로 살 수 있게 두지 않는다. 상점 가격은 등급에 따라 다르게 매긴다
4. **가챠를 스키마에서 지운다.** `GachaPull` 모델, `User.heroPity`, `User.legendPity`를 삭제한다

**2026-08-20 팀 합의 후 DB·스키마·시드까지 적용 완료.** 마이그레이션 이름은 `20260820120000_skin_tribe_and_drop_gacha`다. 남은 것은 C 브랜치에만 있는 코드 4곳(`app/api/pet/*`, `app/pet/*`)과 `SPEC.md`·`docs/dev/pet.md` 갱신이다. 아래 "적용 순서"에 무엇이 끝났고 무엇이 남았는지 표시해 뒀다.

A가 실 DB와 `feat/pet`을 읽고 구조 적합성을 검토한 결과를 여기 남긴다. 원래 구현은 C 담당이지만(`prisma/seed/items.ts`, `app/api/pet/*`, `app/pet/*`), 스키마 변경이 `prisma/seed/items.ts`와 `scripts/check-reward.ts`의 타입을 깨서 빌드가 통과하지 않았다. 빌드가 깨진 채로 둘 수 없어 그 두 파일까지 A가 함께 고쳤다. `app/api/pet/*`·`app/pet/*`은 `main`에 없어 손대지 않았다.

### 결론

`PetSkin`·`CosmeticItem` 두 테이블 다 거의 그대로 쓸 수 있다. 추가는 `PetSkin.priceShards` 하나, 삭제는 `PetSkin.priceAffinity`와 `CosmeticItem.tribeColor` 둘이다.

종족 그룹핑에 별도 `species` 열거형이나 `baseSkinId` 자기참조는 필요하지 않다 — `TypeCode` 1개가 동물 1종에 정확히 대응하므로 기존 `typeCode`가 그대로 종족 키가 된다. 단, 이 전제는 늑대·삵·판다를 없앤다는 결정에 의존한다. 같은 `typeCode` 안에 서로 다른 동물이 공존하면 `typeCode`만으로는 종족을 식별할 수 없다.

### 결정한 것 (2026-08-20 사용자)

1. **늑대·삵·판다는 변종 스킨으로 대체한다.** 친밀도 전용 캐릭터와 고유 효과(씨앗 +15% / 별조각 +10% / 친밀도 +20%)는 없어진다. 외형만 바뀌는 스킨과 능력이 붙은 캐릭터가 한 목록에 섞이면 "외형만 바뀐다"는 규칙이 깨진다
2. **스킨은 별조각 전용, 치장 아이템은 친밀도 전용.** 가챠 컷으로 별조각이 소모처를 잃은 상태였다(3단계 미션 12개가 총 60개를 지급하는데 쓸 곳이 없다). 스킨 상점이 그 구멍에 맞는다. 전용이므로 `PetSkin.priceAffinity`는 지운다 — 컬럼이 남아 있으면 "친밀도로도 살 수 있나"가 코드마다 다시 갈린다. 실 DB에서 기본 3종은 이 값이 `null`이고 값이 든 늑대·삵·판다는 삭제 대상이라 잃는 데이터가 없다
3. **변종은 종족당 1개로 시작한다.** 이미지 장수가 곧 작업량이다. 기본 9장(3동물 × 3단) + 변종 9장 = 18장. 구조는 개수 제한이 없으므로 발표 후 시드만 추가하면 늘어난다
4. **치장 아이템에서 종족 구분을 없앤다.** `CosmeticItem.tribeColor`를 지운다. 종족 소속감은 기본 펫과 종족 배지가 담당하고, 치장은 12종을 누구나 쓴다. 실 DB의 `tribeColor`는 여우↔고양이가 뒤바뀐 옛 매핑을 그대로 물고 있었고, 밤별 3종은 셋 다 한 종족 색으로 고정돼 있었다 — 컬럼을 지우면 두 문제가 함께 사라진다
5. **치장 아이템의 등급(`rarity`)은 유지한다.** 가챠가 없어져 등급이 추첨 확률로 쓰이지 않으므로, 등급을 그대로 **가격 기준**으로 쓴다. 스키마 변경 없이 시드 값만 채우면 된다
6. **가챠는 스키마에서도 지운다.** `GachaPull` 0행, `User.heroPity`·`legendPity` 값 전부 0인 지금이 데이터를 잃지 않고 지울 수 있는 시점이다

### 스키마 변경

```prisma
model PetSkin {
  id       String   @id @default(cuid())
  name     String   @unique // 여우 / 북극여우 / 사막여우. 어미가 종족명이다
  typeCode TypeCode        // 종족. 같은 값이면 같은 동물이다

  isDefault  Boolean @default(false) // 진단으로 지급되는 기본 외형
  stageCount Int     @default(3)     // 1에서 3으로. 외형만 바뀌므로 변종도 3단이다

  effectType EffectType @default(NONE) // 외형 스킨은 전부 NONE
  effectPct  Int        @default(0)

  priceShards  Int? // 신규. 별조각 구매가. 기본 외형은 null
  imageKeyBase String
  // priceAffinity 삭제. 스킨은 별조각 전용이다

  owners      UserPetSkin[]
  activeUsers User[]        @relation("ActiveSkin")
}
```

`effectType`·`effectPct`는 지우지 않는다. `calculateReward()`가 `NONE`이면 그대로 통과시키므로 남겨도 무해하고, 지우면 `lib/reward.ts`(C 소유 공유 함수)의 시그니처가 흔들린다. 나중에 능력치 스킨을 되살릴 여지도 남는다.

`CosmeticItem`에서는 `tribeColor` 한 줄만 빠진다. `slot`·`rarity`·`affinityOnly`·`priceAffinity`는 그대로다.

```prisma
model CosmeticItem {
  id     String @id @default(cuid())
  name   String @unique
  slot   Slot
  rarity Rarity // 추첨 확률이 아니라 가격·희소도 표기로 쓴다

  affinityOnly  Boolean @default(false)
  priceAffinity Int?
  imageKey      String

  owners UserCosmetic[]
}
```

`User`에서 `heroPity`·`legendPity`·`gachaPulls`를 지우고, `model GachaPull`을 통째로 지운다. 이 세 줄은 `feat/pet`에 이미 반영돼 있으나 **대응 마이그레이션이 없어 스키마와 실 DB가 갈라진 상태다.** 이번 마이그레이션이 그 드리프트를 닫는다.

### 마이그레이션

**파괴적 작업 4개가 들어 있다.** `GachaPull` 테이블 삭제, `CosmeticItem.tribeColor` 컬럼 삭제, `PetSkin.priceAffinity` 컬럼 삭제, `User.heroPity`·`legendPity` 컬럼 삭제다. 지금은 `GachaPull` 0행 / `UserCosmetic` 0행 / pity 값 전부 0 / `priceAffinity`에 값이 든 3행은 삭제 대상이라 잃는 데이터가 없다. 행이 쌓인 뒤에는 이 순서로 지울 수 없다.

`prisma migrate dev`는 대화형 명령이라 이 환경에서 실행할 수 없다(`Prisma Migrate has detected that the environment is non-interactive`). SQL을 `migrate diff`로 뽑아 마이그레이션 디렉터리에 직접 넣고 `migrate deploy`로 적용했다.

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
# 출력을 prisma/migrations/20260820120000_skin_tribe_and_drop_gacha/migration.sql 로 저장
npx prisma migrate deploy
npx prisma generate
```

적용 후 `migrate diff --exit-code`가 "No difference detected"를 돌려주는 것까지 확인했다.

적용된 SQL:

```sql
ALTER TABLE "GachaPull" DROP CONSTRAINT "GachaPull_itemId_fkey";
ALTER TABLE "GachaPull" DROP CONSTRAINT "GachaPull_userId_fkey";
ALTER TABLE "CosmeticItem" DROP COLUMN "tribeColor";
ALTER TABLE "PetSkin" DROP COLUMN "priceAffinity",
ADD COLUMN     "priceShards" INTEGER,
ALTER COLUMN "stageCount" SET DEFAULT 3;
ALTER TABLE "User" DROP COLUMN "heroPity", DROP COLUMN "legendPity";
DROP TABLE "GachaPull";
```

나머지 4인은 공지를 받고 이것만 실행한다.

```bash
git pull && npx prisma migrate deploy && npx prisma generate
```

### 치장 아이템 — 등급을 가격으로 쓴다

가챠가 없어지면 `rarity`는 추첨 확률로 쓰이지 않는다. 그런데 실 DB에서 치장 12종 중 **가격이 있는 것은 밤별 3종(친밀도 200)뿐이고, 나머지 9종은 `priceAffinity`가 `null`이라 획득 경로가 없다.** 등급을 그대로 가격 기준으로 쓰면 스키마 변경 없이 이 구멍이 닫힌다.

| 등급 | 친밀도 가격 | 실 DB 개수 |
|---|---|---|
| COMMON | 50 | 3 |
| RARE | 100 | 3 |
| EPIC | 200 | 5 (밤별 3종 포함) |
| LEGENDARY | 400 | 1 |

12종 전부 모으면 1,850 친밀도다. 친밀도는 하루 최대 100까지만 지급되므로(`SPEC.md` 5절) 약 19일 분량이다. 밤별 3종이 이미 EPIC 200이라 값이 그대로 맞아 떨어진다.

부작용 하나. 12종이 전부 친밀도 구매가 되면 **`affinityOnly` 플래그가 항상 `true`가 되어 의미를 잃는다.** 그래도 **컬럼은 지우지 않고 12종 전부 `true`로 채운다.** `CosmeticList.tsx:132`가 `item.affinityOnly && item.priceAffinity`로 가격을 그리므로, 값만 채우면 코드를 한 줄도 고치지 않고 12종 전부에 가격이 뜬다. 컬럼을 지우면 `route.ts`·`page.tsx`·`CosmeticList.tsx` 3개를 함께 고쳐야 한다 — 마감 이틀 전에 살 이유가 없는 변경이다.

### 스킨 — 별조각 가격

`PetSkin`에는 `rarity`가 없다. 종족당 변종이 1개뿐인 지금은 등급 차등이 표현할 것이 없으므로 **균일 별조각 50**으로 둔다. 3단계 미션 12개가 주는 별조각 총량이 60이라, 자기 종족 변종 1개를 정확히 살 수 있는 값이다.

| 스킨 | 별조각 |
|---|---|
| 기본 외형(여우·고양이·곰) | `null` (진단으로 지급) |
| 변종 외형(북극여우·샴고양이·북극곰) | 50 |

나중에 변종이 늘어 등급을 매기고 싶어지면 `priceShards`를 행마다 다르게 넣으면 된다. `rarity` 컬럼 추가는 필요하지 않다.

### `stageCount`를 3으로 올려야 하는 이유

지금 친밀도 캐릭터는 `stageCount = 1`이고, 코드가 그 값으로 진화 단계를 깎는다.

```ts
// app/api/pet/skins/activate/route.ts
const evolutionStage = cappedStage(user.level, mine.petSkin.stageCount)

// app/pet/_components/PetView.tsx
const stage = pet.stageCount > 1 ? Math.min(pet.evolutionStage, 3) : 2
// 표시도 "단일 형태"로 바뀐다
```

15레벨 3단 펫이 `stageCount = 1` 스킨으로 갈아타면 `evolutionStage`가 1로 떨어진다. 외형만 바뀌어야 하니 변종도 3단이어야 한다. 전부 3이 되면 위 분기는 자동으로 무해해지고, 지금 있는 퇴화 동작이 함께 사라진다.

### 시드

```
여우      HEALTH_EMOTION          isDefault  stage3  pets/fox
북극여우  HEALTH_EMOTION          별조각 50  stage3  pets/fox-arctic
고양이    INDEPENDENT_LOW_INCOME  isDefault  stage3  pets/cat
샴고양이  INDEPENDENT_LOW_INCOME  별조각 50  stage3  pets/cat-siamese
곰        FAMILY_LIVING           isDefault  stage3  pets/bear
북극곰    FAMILY_LIVING           별조각 50  stage3  pets/bear-polar
```

`imageKeyBase`는 그대로 쓸 수 있다. `stageCount`가 3이면 뒤에 `-1 -2 -3`을 붙이는 기존 규칙을 변종도 그대로 따른다.

**어미 규칙은 스키마로 강제하지 않는다.** 접미사 문자열 매칭을 런타임 그룹핑에 쓰면 오타 한 번에 그룹이 깨진다. 그룹핑은 `typeCode`가 하고, 어미는 `npm run check:pet`에 단정 한 줄로 못 박는다.

```ts
for (const skin of SKINS)
  assert(
    skin.name.endsWith(TRIBE[skin.typeCode].animal),
    `${skin.name}의 어미가 ${skin.typeCode} 종족명과 다르다`
  )
```

치장 12종은 `tribeColor` 필드를 빼고, 12종 전부에 `affinityOnly: true`와 등급별 `priceAffinity`를 채운다.

**시드만 고쳐서는 늑대·삵·판다가 DB에서 사라지지 않는다.** 시드는 `name`을 키로 upsert하므로 목록에서 뺀 행은 그대로 남는다. 실 DB에 이미 3행이 들어가 있다(A가 2026-08-20에 확인). 명시적으로 지워야 한다. 지금은 안전한 시점이다 — `UserPetSkin` 1건은 여우를 가리키고, `GachaPull`의 FK는 `CosmeticItem` 쪽이라 `PetSkin`을 참조하지 않는다.

```sql
DELETE FROM "PetSkin" WHERE "name" IN ('늑대', '삵', '판다');
```

그다음 `npm run db:seed`를 돌린다.

**여기서 사고가 하나 났다. 기록해 둔다.** `main`의 `prisma/seed/items.ts`는 옛 치장 이름(앰버·라벤더·세이지)을 들고 있었지만 **실 DB는 이미 C의 확정 컬러명(노을·새벽·이끼)으로 재시드된 상태였다.** 시드의 upsert 키가 `name`이라, 옛 이름 목록으로 시드를 돌리자 기존 9행이 갱신되는 대신 옛 이름 9행이 새로 생겨 치장이 21종이 됐다. `UserCosmetic`이 0행이라 지우는 것으로 정리했다.

```sql
DELETE FROM "CosmeticItem" WHERE "name" IN (
  '앰버 모자', '라벤더 모자', '세이지 모자',
  '라벤더 목도리', '세이지 목도리', '앰버 목도리',
  '세이지 배경', '앰버 배경', '라벤더 배경'
);
```

`main`의 시드 목록을 확정 컬러명으로 맞춰 두었으므로 이제 다시 돌려도 12종을 유지한다. C의 `RENAMED_COSMETICS` 이관 표는 이미 이관이 끝났으므로 `feat/pet`을 머지할 때 함께 지워도 된다.

동물 매핑(여우 = 개과 = `HEALTH_EMOTION`)도 실 DB에는 이미 반영돼 있었다. `main`의 시드만 옛 값이었고, 이번에 함께 맞췄다.

### 코드 변경

| 파일 | 변경 |
|---|---|
| ~~`prisma/seed/items.ts`~~ | **완료(A, 2026-08-20).** `tribeColor` 삭제, 늑대·삵·판다를 북극여우·샴고양이·북극곰으로 교체(`stageCount: 3`, `priceShards: 50`, `effectType: NONE`), 치장 12종에 `affinityOnly: true` + 등급에서 파생시킨 `priceAffinity`. 가격은 `PRICE_BY_RARITY` 한 곳에서 나온다 |
| ~~`scripts/check-reward.ts`~~ | **완료(A, 2026-08-20).** 더미 `PetSkin`의 `priceAffinity: null`을 `priceShards: null`로 |
| ~~`app/api/pet/cosmetics/route.ts`~~ | **완료(A, 2026-08-20 머지 시).** 응답에서 `tribeColor` 삭제 |
| ~~`app/api/pet/skins/route.ts`~~ | **완료(A).** `findMany`에 `where: { typeCode: user.typeCode }`, `user.typeCode`가 `null`(진단 전)이면 빈 목록. 응답의 `affinity`·`priceAffinity`를 `starShards`·`priceShards`로 |
| ~~`app/api/pet/skins/buy/route.ts`~~ | **완료(A).** `skin.typeCode !== user.typeCode`면 `WRONG_TRIBE`로 400. 가격은 `priceShards`, 차감은 `starShards`(`NOT_ENOUGH_SHARDS`). 연타 방어용 조건부 `updateMany` 패턴은 그대로 유지 |
| ~~`app/pet/skins/page.tsx`~~ | **완료(A).** 서버 쪽 목록도 같은 종족 필터. `starShards`를 넘긴다 |
| ~~`app/pet/_components/SkinList.tsx`~~ | **완료(A).** 묶음을 "기본 외형 / 상점"으로, 고유 효과 표기 삭제, 가격 표기를 "별조각 N"으로 |
| ~~`lib/pet.ts`~~ | **완료(A).** `animalEmoji()`가 완전일치로만 찾아 변종 3종이 전부 🐾로 떴다. `endsWith`로 어미를 찾아 기본 동물 이모지를 쓰고, 없어진 캐릭터의 `AFFINITY_EMOJI`를 지웠다 |
| `scripts/check-pet.ts` | 어미 = 종족명 단정 추가 — **남음(C)** |
| `app/api/pet/cosmetics/buy/route.ts` | 치장 구매 라우트가 없다 — **남음(C)**. 아래 "남는 문제" |

`lib/reward.ts`·`UserPetSkin`·`app/api/pet/skins/activate/route.ts`는 손대지 않았다.

**파일 소유 규칙을 넘었다.** 위 6개 파일은 전부 C 소유다(`CLAUDE.md` 2절). `develop`을 머지하니 이 파일들이 삭제된 컬럼을 참조해 `npm run build`가 깨졌고, 빌드 깨진 커밋을 `develop`에 올리면 5인 전원의 Amplify 배포가 막힌다(`CLAUDE.md` 3절). 사용자 승인을 받고 A가 최소 수정만 했다. 소유는 그대로 C다.

### 갱신할 문서

| 문서 | 절 | 변경 | 담당 |
|---|---|---|---|
| `SPEC.md` | 5 | 가챠 절 삭제(`feat/pet`에 이미 반영). "친밀도 전용 캐릭터"를 "종족 외형 스킨"으로 재작성하고 고유 효과 표를 지운다. 별조각 소모처를 "미정"에서 "종족 외형 스킨 구매"로. 치장 절에 등급별 가격표 추가, "가챠 추첨 풀에서 제외" 문구 삭제 | C |
| `SPEC.md` | 6 | `calculateReward()` 통과 목록에서 "가챠 중복 환급" 삭제 | C |
| `SPEC.md` | 11 | `GachaPull.wasDuplicate`·`refundShards` 줄 삭제, `affinityOnly` 설명에서 가챠 언급 삭제, `tribeColor` 삭제. `rarity`는 남기고 설명을 "가챠 등급"에서 "가격·희소도 표기"로 | C |
| `SPEC.md` | 2 | 치장 컬러명(노을·새벽·이끼)이 더 이상 종족과 대응하지 않음을 명시 | C |
| `docs/dev/pet.md` | 전체 | 제목 "펫·가챠" → "펫", 가챠 항목 삭제, 스킨·치장 구조 반영 | C |
| `docs/STATUS.md` | 담당별 상태 | C 범위 "펫 + 가챠" → "펫 + 스킨" | C |
| `docs/STATUS.md` | 결정 변경 | 스킨 종족 전용 / 치장 종족 무관 / 가챠 스키마 삭제 3건 추가 | C |
| `docs/인수인계.md` | C 절 | `/api/gacha/*`와 가챠 서술 삭제 | C |
| `업무분담.md` | C 절, 데모 순서 | 가챠 항목 삭제 | C |
| `docs/dev/diagnosis.md` | 15 | 이 절 | A (완료) |
| `prisma/schema.prisma` | — | 스키마 변경 + 마이그레이션 | A (완료) |
| `docs/STATUS.md` | 차단 사항 | 차단 1(시드 동물 매핑) 해소 | A (완료) |

`CLAUDE.md`는 가챠 언급이 없어 손댈 것이 없다.

### 적용 순서

1. ~~`prisma/schema.prisma` 수정~~ — 완료. `feat/diagnosis`의 `4934868`
2. ~~마이그레이션 생성·적용~~ — 완료. `20260820120000_skin_tribe_and_drop_gacha`. 나머지 4인은 `git pull && npx prisma migrate deploy && npx prisma generate`
3. ~~늑대·삵·판다 `DELETE` → `npm run db:seed`~~ — 완료. 스킨 6종 / 치장 12종(합 1,850 친밀도) 확인
4. ~~`prisma/seed/items.ts`·`scripts/check-reward.ts`~~ — 완료. `npm run build`, `npm run check:reward` 통과
5. ~~`app/api/pet/*` 3개 + `app/pet/skins/page.tsx` + `SkinList.tsx` + `lib/pet.ts`~~ — 완료. `develop` 머지 때 A가 고쳤다. `npm run build`·`check:reward`·`check:diagnosis`·`check:pet` 통과, `/pet/skins` 화면과 `GET /api/pet/skins`·`/api/pet/cosmetics` 실 응답까지 확인
6. **남음** — `scripts/check-pet.ts` 어미 단정, 치장 구매 라우트, `SPEC.md`·`docs/dev/pet.md`·`docs/인수인계.md`·`업무분담.md` 갱신(위 표)

### `develop` 머지 실제 결과 (2026-08-20)

`main`이 아니라 `develop`을 통합 지점으로 잡았고, C·D·E가 먼저 머지한 뒤 A가 `git merge origin/develop`(`d8edf2b`)을 했다. 예고했던 대로 3개 파일이 충돌했다. `prisma/migrations/`는 A만 갖고 있어 충돌 없이 그대로 들어갔다.

| 파일 | 해결 |
|---|---|
| `prisma/schema.prisma` | HEAD(`tribeColor` 삭제) 채택. develop 쪽을 택하면 실 DB에 없는 컬럼을 Prisma가 select해 `CosmeticItem` 전 쿼리가 P2022로 죽는다 |
| `prisma/seed/items.ts` | HEAD 구조 채택. develop의 `TypeCode ↔ 종족` 매핑 주석과 "upsert 키는 name" 경고는 남겼다. `renameLegacyCosmetics()`와 `RENAMED_COSMETICS`는 실 DB 이관이 끝나 no-op이므로 지웠다 |
| `docs/STATUS.md` | 손으로 합쳤다. develop의 담당별 최신 상태·origin 브랜치 표를 살리고, 구조 변경으로 해소된 차단 1·6·8과 재현되지 않는 7을 해소 표시로 바꿨다 |

`npm run db:seed`는 develop STATUS의 차단 7과 달리 그냥 통과한다(`tsx` 4.x가 `.env`를 읽는다). `npm run lint`는 `app/page.tsx`의 `setGreeting`을 `fetchMe().then()` 안으로 옮겨 A 쪽 에러를 없앴다. 남은 에러 1건은 D의 `PostDetailModal.tsx:54`다.

### 뒤집히는 기존 결정

`app/api/pet/skins/route.ts`의 주석이 지금은 이렇게 되어 있다.

```
구매 제한을 두지 않는다 — 유형과 무관하게 3종 모두 살 수 있다(SPEC.md 5절).
자기 과로 제한하면 유저당 1개뿐이라 "고르고 전환한다"가 사라진다.
```

새 구조는 이 판단을 뒤집는다. 다만 **C의 원래 근거는 자동으로 해소된다** — 종족당 변종이 여러 개 생기므로 자기 종족으로 제한해도 고를 것이 남는다.

### 남는 문제

**치장 구매 라우트가 없다 (C).** 가격은 시드·실 DB에 다 들어갔고 `GET /api/pet/cosmetics`가 `affinityOnly`·`priceAffinity`를 내려주지만 `POST /api/pet/cosmetics/buy`가 없다. 그래서 치장 화면은 여전히 전부 "미획득"으로 보인다. `app/api/pet/skins/buy/route.ts`를 그대로 베끼면 된다 — 친밀도를 차감하고, 종족 검사는 없고(치장은 종족 무관), `affinityOnly && priceAffinity !== null`만 확인한다. `calculateReward()`는 통과하지 않는다(획득이 아니라 소모다).

**재진단하면 옛 종족 스킨이 유령이 된다.** `app/api/diagnosis/complete/route.ts`가 새 `typeCode`의 기본 외형으로 `activePetSkinId`를 다시 심으므로 화면은 깨지지 않는다. 다만 `UserPetSkin`에 남은 옛 종족 스킨은 상점·목록 어디에도 안 보인 채로 소유 기록만 남는다. 별조각 환불이든 유지든 정책이 필요하다. 지금 `UserPetSkin`이 1건뿐이라 정하기에 가장 싼 시점이다.

~~**이 작업은 `feat/pet` 머지가 먼저다.**~~ — `feat/pet`은 `develop`에 들어갔고 A도 `develop`을 받았다. 위 파일들은 이제 `feat/diagnosis`에 다 있다.

### 머지 후 발견한 문제 (2026-08-20, `feat/missions` 머지 뒤 검증)

B가 `feat/missions`를 `develop`에 머지해(`3adbea5`) 5인 중 4인이 통합됐다. D만 5커밋 남았고 예측 충돌은 `docs/STATUS.md` 1건뿐이다. 통합 검증은 전부 통과했다 — 충돌 마커 0건, `npm run build` 통과(라우트 31개), 마이그레이션 3개 중복 없음, 실 DB 드리프트 없음, 체크 스크립트 3종 통과, 화면 7장·API 6종 200 + 실데이터, 재화 증감은 B도 `calculateReward()`를 경유한다.

기능은 합쳐졌지만 내비 교체 때문에 다음이 남았다. **번호별 담당은 커밋 작성자로 확인했다**(`Yoon` = B, `uchan04` = E, `centreject` = A).

| # | 문제 | 고칠 사람 |
|---|---|---|
| 1 | `app/components/Sidebar.tsx:8`의 `TEMP_SIDEBAR_PROFILE`이 하드코딩이다. 화면엔 "고요한 고양이 / 씨앗 42개 / Lv.3", 실제 `GET /api/pet`은 "밤바다 / 씨앗 0 / Lv.1". 발표 시연에서 그대로 보인다 | B |
| 2 | 같은 파일이 `CHARACTER_COLOR`·`CHARACTER_LABEL`을 다시 정의해 종족 색·표시명이 3중 정의가 됐다(8/19에 닫은 차단 5번과 같은 문제). 출처는 `lib/types.ts`의 `TRIBE`다 | B |
| 3 | `app/layout.tsx:16`이 `<main>`을 열고 A·C 화면도 `<main className="hm">`을 열어 `/`·`/diagnosis`에 `<main>`이 2개다. 유효하지 않은 HTML이고 랜드마크가 중복된다. layout 한 곳에서 `<div>`로 바꾸는 것이 화면 6장을 고치는 것보다 싸다 | E |
| 4 | 결정 9번이 정한 "진단 문항 화면에서 내비 숨김"이 빠졌다. `Sidebar.tsx`에 `usePathname`은 이미 있고 경로 분기만 없다 | B |
| 5 | ~~죽은 `--nav-h`~~ 고쳤다(아래). 고아가 된 `app/components/BottomNav.tsx`는 아무도 import하지 않는다 — 삭제는 E 몫 | A(완료) / E |
| 6 | `BEDROCK_VISION_MODEL_ID`가 Amplify 환경변수에 없다. `lib/missions/vision.ts:7`이 `us.amazon.nova-2-lite-v1:0`으로 폴백해 죽지는 않는다 | E |

**5번 A 몫은 처리했다.** `styles/tokens.css`에서 `--nav-h: calc(2.5rem + 1px)`와 `min-height: calc(100dvh - var(--nav-h))`를 `min-height: 100dvh`로 되돌렸다. 근거는 `app/layout.tsx`이 화면 전체를 flex로 잡고 본문 칸에 `overflow-y: auto`를 걸어 그 칸의 높이가 정확히 뷰포트이기 때문이다. 실측으로 `--nav-h`가 사라졌고 `.hm`의 `min-height`(709.6px)가 스크롤 칸 높이(710px)와 맞는 것을 확인했다.

**B가 E 소유 공유 파일 4개를 브랜치에서 고쳤다** — `app/layout.tsx`·`app/globals.css`(`65308c4`), `.env.example`(`7890af4`), 그리고 내비인 `Sidebar.tsx` 신규. `CLAUDE.md` 1절이 금지한 것이다. E가 같은 기간에 그 파일들을 안 건드려 충돌은 안 났다. 결정 9번은 사이드바를 E에게 배정했는데 B가 먼저 구현한 상태라, **소유권을 E에게 되돌릴지 사이드바만 B에게 넘길지 팀이 정해야 한다.** 안 정하면 남은 이틀 동안 둘이 같은 파일을 각자 고친다.

`npm run lint` 에러는 12건으로 늘었다 — B 11건(`any` 8, `set-state-in-effect` 1 등), D 1건(`PostDetailModal.tsx:54`). A는 0건이다. 빌드는 통과하므로 Amplify 배포는 막히지 않는다.
