# 유형 진단 개발 문서 (담당 A)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 2·3·4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 없음
- 진행 중: 진단 6문항 설계
- 미착수: 판정 함수, 스냅샷 테스트, 진단 화면, Bedrock 호출 2종, 결과 화면, 재진단, 미션 콘텐츠 36개

## 구현한 파일
- `lib/types.ts` — 종족·형용사 매핑, 기본 닉네임, 성장 곡선 상수 (골격 완료)
- `prisma/seed/missions.ts` — 일일 5개 완료, 단계 미션 1개(형식 예시). 36개 미작성

## 작업 순서

DB가 아직 없다(`DATABASE_URL` 미공유). 그래서 **DB가 필요 없는 것부터 한다.** 미션 콘텐츠와 판정 로직은 순수 파일·순수 함수라 지금 당장 끝낼 수 있고, 마침 이 둘이 팀에서 가장 급한 항목이다.

### 1단계 — DB 없이 (8/15)

1. **미션 콘텐츠 36개** (`prisma/seed/missions.ts`) — 최우선. B의 미션 시스템과 C의 펫이 이 데이터를 기다린다
2. **6문항 정의** (`lib/diagnosis/questions.ts`) — 문항 코드, 선택지 코드, axis, weight
3. **판정 함수** (`lib/diagnosis/classify.ts`) — 답변 배열 → `{ typeCode, adjective, axisScores }`. 순수 함수, LLM 없음
4. **스냅샷 테스트 18개** (`scripts/check-diagnosis.ts`) — 3유형 × 6시나리오

### 2단계 — DB 연결 후 (8/16)

5. 진단 화면 6문항 + 진행률 바 (`app/diagnosis/page.tsx`) — 선택지 버튼만, LLM 없이 동작
6. 진단 완료 API (`app/api/diagnosis/complete/route.ts`) — 판정 → `User.typeCode`·`adjective`·`nickname`·`activePetSkin` 세팅 + `DiagnosisSession` 저장
7. 결과 화면 — 종족·컬러·기본 닉네임 + 닉네임 즉시 변경

### 3단계 — Bedrock 확인 후 (8/17)

8. 자유 입력 → 선택지 코드 변환 (tool use, 실패 시 버튼 폴백)
9. 판정 근거 3줄 요약
10. 질문 문장 다듬기 + 다음 문항 프리페치 — **A 담당분 중 가장 먼저 자를 항목**

### 4단계 (8/18)

11. 재진단 — `typeCode`·종족·기본 펫만 갱신. 레벨·경험치·재화·아이템은 유지

## 문항 설계 초안

축은 `housing` / `health` / `employment` 3개. Q6은 형용사 전용이라 축이 없다.

| 문항 | 내용 | 축 |
|---|---|---|
| Q1 | 지금 누구와 살고 있나 | housing |
| Q2 | 요즘 기분·의욕 | health |
| Q3 | 몸 상태와 병원 이용 | health |
| Q4 | 일·구직 상태 | employment |
| Q5 | 돈 걱정·부채 | employment |
| Q6 | 편한 시간·장소 (4지선다) | — (형용사) |

판정 규칙:

```
Q1이 가족 동거          → FAMILY_LIVING 확정 (다른 축을 보지 않는다)
health 신호 2개 이상    → HEALTH_EMOTION
그 외                   → INDEPENDENT_LOW_INCOME
```

**모든 답이 약한 경우의 기본값은 `INDEPENDENT_LOW_INCOME`이다.** 1인 가구 자체가 이 유형의 핵심 특성(92%)이기 때문이다. 기본값을 정하지 않으면 판정 함수에 미정의 경로가 생기고 스냅샷 테스트를 쓸 수 없다.

## 결정한 것과 이유
- 판정은 100% 코드. LLM은 질문 문장 다듬기와 자유 입력 enum 변환만 담당
- 형용사는 6번 문항 4지선다에 1:1 매핑. `ADJECTIVE_BY_CHOICE` 상수 테이블
- 진단 로직은 `lib/diagnosis/` 하위에 새로 만든다. `lib/types.ts`는 4명이 import하는 공유 파일이라 문항·판정 코드까지 넣으면 충돌 위험이 커진다
- 화면은 선택지 버튼만으로 먼저 완성한다. Bedrock이 늦어져도 진단 플로우 전체가 동작해야 한다
- 스냅샷 테스트는 테스트 프레임워크 없이 `scripts/check-reward.ts`와 같은 방식(`node:assert`)으로 만든다

## 막힌 것
- `DATABASE_URL` 미공유 (E 대기). 1단계 작업에는 영향 없음
- Bedrock 연결 확인 미완 (E 대기). 3단계에서 필요

## 미션 문구 작성 기준

타겟 특성상 문구 톤이 기능만큼 중요하다.

- 명령·강요 표현을 쓰지 않는다. "~하세요"보다 "~해봐요", "~해도 좋아요"
- 실패해도 부담이 없게 쓴다. "1분만", "한 번만", "안 되면 내일 해도 괜찮아요"
- 1단계는 침대에서 손만 움직여도 되는 수준으로 낮춘다
- 사진 업로드 미션은 3단계에만 배치한다
- 근거는 연구보고서 PDF의 유형별 특성을 따른다

## 다음 할 일
1. `prisma/seed/missions.ts`에 단계 미션 36개 작성 (유형당 12개 = 3단계 × 4개)
2. `lib/diagnosis/questions.ts` 6문항 확정
3. `lib/diagnosis/classify.ts` 판정 함수
4. `scripts/check-diagnosis.ts` 시나리오 18개
