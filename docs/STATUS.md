# 진행 상황

**모든 세션은 이 문서부터 읽는다.** 그다음 아래 "지금 읽어야 할 문서"만 읽고 시작한다.

최종 갱신: 2026-08-19
현재 단계: **D2 — 인프라 완료, 기능 5개 병렬 착수 (8/19 중간 체크포인트)**

팀원 인수인계용 단일 문서는 [`docs/인수인계.md`](인수인계.md)에 있다. 새로 합류하거나 노션으로 공유할 때는 그 문서를 쓴다.

---

## 지금 읽어야 할 문서

단계가 바뀌면 이 표를 갱신한다. 여기에 없는 문서는 읽지 않는다.

| 담당 | 읽을 문서 |
|---|---|
| 전원 | `docs/STATUS.md`(이 문서), `CLAUDE.md` |
| A | `docs/dev/diagnosis.md` + `SPEC.md` 2·3·4절 |
| B | `docs/dev/missions.md` + `SPEC.md` 4절 |
| C | `docs/dev/pet.md` + `SPEC.md` 5·6절 |
| D | `docs/dev/community.md` + `SPEC.md` 7·8절 |
| E | `docs/dev/infra.md` + `SPEC.md` 10절 |

`업무분담.md`는 일정·컷 순서를 확인할 때만 읽는다. 매 세션 읽을 필요는 없다.
`아이디어.md`와 연구보고서 PDF는 미션 콘텐츠를 만들 때(A)만 읽는다.

---

## 담당별 상태

| 담당 | 범위 | 상태 | 비고 |
|---|---|---|---|
| A | 진단 + 미션 콘텐츠 | 1단계 완료 (미션 41개, 6문항, 판정 함수, 체크 18개) | `DATABASE_URL` 확보됨, 화면·API 착수 가능 |
| B | 미션 시스템 + 사진 업로드 | 미착수 | `DATABASE_URL`·S3 버킷 확보됨, 착수 가능 |
| C | 펫 + 가챠 | `lib/reward.ts` 골격 완료 | `DATABASE_URL` 확보됨, 착수 가능 |
| D | 커뮤니티 + 챗봇 | 기능 구현 끝. 챗봇 Bedrock 스트리밍 연결 완료(2026-08-19). 미션 완료 연동 호출부(`completeMission`)는 주석으로 준비만 해둠 | `completeMission()`(B) 대기 상태. 막힌 항목 5개와 주의사항은 `docs/dev/community.md` 상단 "재개 지점" 참고 |
| E | 인프라 + 인증 | RDS·Cognito·S3+CloudFront·CloudWatch+SNS·Bedrock·auth 실검증·하단 탭 내비 완료 | Amplify GitHub 연동만 남음(브라우저 수동 단계) |

## 전체 차단 사항

지금 프로젝트를 멈춰 세우는 것만 적는다. 해결되면 즉시 지운다.

(없음 — 전원 착수 가능. `.env`의 `DATABASE_URL`·`COGNITO_*`·`S3_BUCKET`·`CLOUDFRONT_DOMAIN`·`BEDROCK_MODEL_ID`는 E에게 개별 공유받는다)

**남은 수동 단계**: Amplify Hosting ↔ GitHub 연동. GitHub App 설치는 브라우저 OAuth 동의가 필요해 계정 소유자가 직접 눌러야 한다. 절차는 `docs/dev/infra.md` 참고

**보안 재검토 필요**: RDS를 팀원 로컬 개발 편의를 위해 Publicly Accessible=true로 설정했다(포트 5432를 0.0.0.0/0에 개방, 강력한 마스터 비밀번호로만 방어). 발표 전에 팀 전체가 재검토할 것 — 상세 이유는 `docs/dev/infra.md` "결정한 것과 이유" 참고

**클라이언트 Authorization 헤더 — 로그인 화면·토큰 보관은 E 담당, 방식 확정 대기**: `lib/auth.ts` 서버 검증은 완료됐으나 클라이언트가 토큰을 싣지 않는다. 이대로 배포하면 전 API가 401이다.

GitHub 원격은 해결됐다 — https://github.com/uchan04/AWS_project

## 마일스톤

| 날짜 | 목표 | 상태 |
|---|---|---|
| 8/14 | 레포·프로젝트·브랜치, auth 스텁, schema 초안 | 완료 (지연 반영) |
| 8/15 | RDS + 마이그레이션 + `DATABASE_URL` 공유, 첫 라이브 배포 | RDS·마이그레이션 완료(8/19). Amplify 라이브 배포는 GitHub 연동 대기 |
| 8/16 | schema 확정, 미션 41개, Cognito | 미션 41개·Cognito 완료. schema는 이미 안정적으로 사용 중 |
| 8/16 | 기능 5개 병렬 착수, 하루 2회 통합 시작 | 8/19부터 착수 가능 (차단 해소) |
| 8/19 | 중간 체크포인트 (컷 판단) | |
| 8/20 | 기능 동결, 발표 자료 착수 | |
| 8/22 | 개발 마감 | |
| 8/26 | 녹화 | |
| 8/28 | 발표 | |

---

## 갱신 규칙

- 하루 2회 통합할 때마다 "담당별 상태"와 "전체 차단 사항"을 갱신한다
- 단계가 넘어가면 "현재 단계"와 "지금 읽어야 할 문서"를 갱신한다
- 세부 내용은 여기에 쓰지 않는다. 담당 기능의 세부는 `docs/dev/<기능>.md`에 쓴다
- 갱신은 `docs:` 커밋으로 남긴다
