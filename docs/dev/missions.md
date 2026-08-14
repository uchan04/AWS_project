# 미션 시스템 개발 문서 (담당 B)

세션이 초기화되면 이 문서를 먼저 읽는다. 작업을 끝낼 때마다 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 4절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: 없음
- 진행 중: 없음
- 미착수: 일일·단계 미션 화면, 접속 시점 초기화, 완료 처리, 달성률·streak, 출석 캘린더, S3 사진 업로드

## 구현한 파일
- 없음

## 결정한 것과 이유
- 초기화는 스케줄러 없이 `User.lastMissionResetAt` 비교
- 중복 완료는 `UserMission @@unique([userId, missionId, resetKey])`로 DB가 막는다. 애플리케이션에서 중복 체크를 하지 않는다
- 단계 해제는 해당 단계 4개 중 3개 완료
- 출석 `dayIndex = (attendanceTotal - 1) % 7 + 1`

## 막힌 것
- 사진 미션은 E의 S3 버킷·CloudFront 설정 대기
- 실제 미션 콘텐츠는 A의 8/15 산출물 대기. 그전에는 `prisma/seed/missions.ts`의 일일 5개로 개발

## 다음 할 일
- 미션 보상 지급 시 `calculateReward()` 경유 확인
