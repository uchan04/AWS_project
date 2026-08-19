# 유형 진단 개발 문서 (담당 A)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 2·3·4절, 규칙은 `CLAUDE.md`.

**이 문서의 4~9장은 확정된 실행 스펙이다.** 값을 새로 정하지 말고 그대로 옮겨 구현한다. 값을 바꿔야 할 이유를 발견하면 먼저 사용자에게 알린다.

**브랜치 규칙 (2026-08-19 변경).** A 담당분은 `feat/diagnosis`에 커밋한다. `main`에 직접 커밋하지 않고 PR로만 올린다. `prisma/schema.prisma` 변경분도 이 브랜치에 담고, 머지 여부와 `prisma migrate dev` 실행은 팀이 결정한다.

## 현재 상태
- 완료: 미션 41개, 지표 14개 정의, 12문항 + 형용사 문항, `classify()`·`classifySub()`, 무손실 조기 종료, 스냅샷 체크, 화면 3장(진단·결과·홈), 화면 3장 디자인 시스템 적용(12장)
- 진행 중: 없음. DB 대기
- 미착수: 완료 API, 닉네임 PATCH, Bedrock 호출 2종, 관리자 교차표

## 구현한 파일
- `lib/types.ts` — 종족·동물·색, 형용사 매핑, 기본 닉네임, 성장 곡선 상수
- `prisma/seed/missions.ts` — 미션 41개. 일일 5 + 단계 36(유형 3 × 단계 3 × 4). 보상·사진 배치는 `stageMission()`이 강제한다
- `lib/diagnosis/questions.ts` — 12문항 + 형용사 문항의 서버 원본. 선택지가 어떤 지표를 켜는지도 여기 있다
- `lib/diagnosis/indicators.ts` — 답변 → 지표 14개. 대분류·세부유형이 전부 이 결과만 본다
- `lib/diagnosis/classify.ts` — `classify()`(3대분류) + `classifySub()`(8세부유형). 순수 함수, LLM·DB 없음
- `lib/diagnosis/adaptive.ts` — `possibleTypes()` / `canDecide()` / `nextQuestion()`. 무손실 조기 종료
- `scripts/check-diagnosis.ts` — `npm run check:diagnosis`
- `app/diagnosis/page.tsx` — 진단 화면 한 장. 클라이언트 컴포넌트. 답변은 state에만 있고 문항마다 서버를 부르지 않는다. 진행 문구는 `canDecide()`로 갈린다(확정 전 "n번째 질문이에요", 확정 후 "거의 다 왔어요")
- `app/diagnosis/draft.ts` — 답변을 결과 화면으로 넘기는 `sessionStorage` 통로. **완료 API가 붙으면 지운다**
- `app/diagnosis/result/page.tsx` — 결과 화면. 종족·동물·색·기본 닉네임. 닉네임은 입력값 자체가 값이라 저장 버튼이 없다(PATCH는 DB 후)
- `app/page.tsx` — 홈. 진단 전에는 시작 버튼 하나, 진단 후에는 종족 행 + 미션·커뮤니티 진입점
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

### 2단계 — DB 없이 계속

5. ~~진단 화면~~ — 완료. 브라우저에서 실제로 클릭해 확인했다(첫 선택지 경로 9문항, 두 번째 선택지 경로 12문항)
6. ~~홈 화면~~ — 완료
7. ~~결과 화면~~ — 완료. 두 번째 선택지 경로에서 고양잇과·스카이 블루·"다정한 고양이"가 나오는 것까지 확인

**화면 3장은 판정 결과를 클라이언트에서 계산한다.** 완료 API가 없어서다. `app/diagnosis/draft.ts`가 유일한 임시 지점이고, API가 붙으면 이 파일과 세 화면의 `classify()` 호출을 함께 지운다.

`lib/diagnosis/classify.ts`가 클라이언트 번들에 들어가므로 세부유형 8개의 코드명이 브라우저 소스에 문자열로 남는다. 화면에 그리지는 않는다. API로 옮기면 사라진다.

### 3단계 — DB 연결 후

8. 진단 완료 API, 닉네임 PATCH
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
- **6·7장의 기대값을 먼저 확정한 뒤 판정 함수를 구현한다.** 순서를 뒤집으면 구현 결과를 그대로 기대값으로 박게 되고, 테스트가 아무것도 검증하지 않는다. 이 테스트가 발표에서 제시할 정확도 근거다

## 3. 막힌 것
- `DATABASE_URL` 미공유 (E 대기). 화면 작업에는 영향 없음
- Bedrock 연결 확인 미완 (E 대기). 4단계에서 필요
- `prisma/seed/items.ts`의 펫 3종이 아직 옛 동물 매핑이다. **C 담당 파일이라 내가 못 고친다.** 요청 대기
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
| `HEALTH_EMOTION` | 여우 | 개과 | `#F59E0B` 앰버 오렌지 | 12.13% |
| `INDEPENDENT_LOW_INCOME` | 고양이 | 고양잇과 | `#38BDF8` 스카이 블루 | 16.75% |
| `FAMILY_LIVING` | 곰 | 곰과 | `#34D399` 에메랄드 그린 | 71.12% |

색은 `lib/types.ts`의 `TRIBE` 한 곳에만 있다. 파스텔 톤으로 바꾸기로 하면 hex 3개만 교체한다(대안값을 그 파일 주석에 적어 둔다).

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

**재진단은 이 엔드포인트를 그대로 다시 호출한다.** `DiagnosisSession`은 매번 새 행이 쌓이므로 이력이 남는다.

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

- **공유 파일을 건드리지 않기 위해 `styles/tokens.css`를 따로 만들었다.** Hallmark 방식대로 하면 전역 CSS와 `layout.tsx`에 폰트·토큰을 넣어야 하는데 둘 다 E 소유다. 대신 각 화면이 `import "@/styles/tokens.css"`로 직접 불러오고, 기본 스타일은 각 화면 `<main className="hm">` 아래로만 적용한다. E의 `globals.css`는 그대로 살아 있다
- **폰트는 CSS `@import`로 불러온다.** `next/font`를 쓰면 `layout.tsx`를 고쳐야 하고, 새 npm 의존성은 `CLAUDE.md`가 금지한다. Gowun Batang(제목) + IBM Plex Sans KR(본문) 2종만 쓴다
- **색은 종이색 계열 + 낮은 채도의 점토색 강조 하나.** 고립은둔 상태에서 쓰는 화면이라 형광·고채도·검정 배경을 피했다. 순수 흑백은 쓰지 않고 전부 따뜻한 쪽으로 살짝 틀어 둔다
- **종족색은 `data-tribe` 속성으로만 넣는다.** 이전에는 `style={{ backgroundColor: tribe.colorHex }}`였다. 인라인 hex를 쓰면 색이 `lib/types.ts`와 CSS 두 곳에 흩어지고, 다크 모드나 색 교체 때 한 곳만 바뀐다. `[data-tribe="..."]`가 `--tribe`를 덮어쓰는 구조라 `lib/types.ts`는 손대지 않았다
- **채도 높은 면적을 화면의 5% 안으로 묶었다.** 결과 화면의 종족판은 종이색에 종족색을 18%만 섞고, 진한 색은 4.5rem 원판 하나로 제한한다. 홈은 2.5rem 원판 하나뿐이다
- **움직임은 두 가지만 쓴다.** 버튼 누름(`translateY(1px)`)과 문항 교체 페이드(`opacity`). `prefers-reduced-motion`에서는 둘 다 죽는다. 진단 화면에서 화면이 크게 움직이면 답을 되돌리기 어렵게 느껴진다
- **닉네임 오류는 `blur` 이후에만 띄운다.** 지우는 중에 빨간 글씨가 따라오면 압박이 된다. 오류는 테두리색·글리프(`!`)·문장·`aria-invalid` 네 가지로 알린다. 색만으로 알리지 않는다
- **도움말과 오류가 같은 자리를 쓴다**(`min-height: 1lh`). 오류가 떠도 아래 버튼이 밀리지 않는다
- 입력창과 버튼 높이를 44px로 맞췄다(`--control-h`). 테두리는 어떤 상태에서도 1px이고 포커스 링 자리를 `outline: 2px solid transparent`로 미리 비워둔다. 상태가 바뀔 때 레이아웃이 흔들리지 않는다
- 진행 표시는 여전히 "n/13"을 쓰지 않는다. 답한 개수만 점으로 보여준다
- 다크 모드는 만들지 않았다. 명세에 없다

**진단 선택지 라벨은 두 줄 이상으로 감긴다.** 선택지가 문장이라 줄일 수 없다. CTA·링크·홈 메뉴 라벨은 전부 한 줄로 고정했다.

검증: 320·375·768px에서 가로 스크롤 없음, 터치 영역 44px 이상, 측정한 색 대비쌍 전부 통과(입력 테두리 3.27:1).

---

## 13. 다음 할 일

1. C에게 `prisma/seed/items.ts` 동물 매핑 교체 요청 (여우 → `HEALTH_EMOTION`, 고양이 → `INDEPENDENT_LOW_INCOME`, 치장 "라벤더" 3종 이름 변경)
2. `DATABASE_URL` 공유 후 완료 API·닉네임 PATCH·관리자 교차표
3. 완료 API가 붙으면 `app/diagnosis/draft.ts`를 지우고 세 화면의 `classify()` 호출을 API 응답으로 바꾼다
4. 펫 이미지가 S3에 올라오면 홈·결과의 종족색 원판을 이미지로 교체 (C·E 대기). 자리와 크기는 `styles/tokens.css`의 `.hm-plate__disc`·`.hm-swatch`가 잡아 뒀다
5. 다른 화면(미션·펫·커뮤니티)도 같은 결로 맞추려면 담당자에게 `design.md`와 `styles/tokens.css`를 알린다. 남의 폴더는 A가 고치지 않는다
