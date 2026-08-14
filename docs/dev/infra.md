# 인프라·인증 개발 문서 (담당 E)

세션이 초기화되면 `docs/STATUS.md` 다음에 이 문서를 읽는다. 작업을 끝낼 때마다 이 문서와 `docs/STATUS.md`를 갱신하고 `docs:` 커밋으로 남긴다.
명세는 `SPEC.md` 10절, 규칙은 `CLAUDE.md`.

## 현재 상태
- 완료: Next.js 프로젝트, Prisma 6 + 스키마, `lib/auth.ts` 스텁, `lib/prisma.ts`, `lib/api.ts`, `.env.example`
- 진행 중: 없음
- 미착수: Amplify, RDS, Cognito, Bedrock 확인, S3 + CloudFront, CloudWatch + SNS, 로그인 화면, 희망 문구 배너, 발표 자료

## 구현한 파일
- `lib/auth.ts` — `getCurrentUser()`. 현재 `DEV_AUTH_BYPASS=true`면 고정 유저를 upsert해 반환하는 스텁
- `lib/prisma.ts` — PrismaClient 싱글턴 (hot reload 커넥션 고갈 방지)
- `lib/api.ts` — `ok()` / `fail()` 응답 헬퍼
- `prisma/seed.ts` — 시드 엔트리

## 결정한 것과 이유
- **Prisma는 6.x로 고정한다.** 7은 `prisma.config.ts` + driver adapter가 필수여서 설정 실패 지점이 늘고 참고 자료도 적다
- `DEV_AUTH_BYPASS`는 배포 환경에서 절대 true로 두지 않는다

## 막힌 것
- RDS 미생성. `DATABASE_URL`이 비어 있어 `prisma migrate dev`를 아직 실행하지 못했다

## 다음 할 일
1. RDS Postgres `db.t4g.micro` 생성 (퍼블릭 액세스 차단, 자동 백업 7일) → `DATABASE_URL` 채우고 `npx prisma migrate dev --name init` → 마이그레이션 커밋
2. GitHub 레포 연결 (아래 "GitHub 레포 연결" 참고) + Amplify Hosting 배포. Amplify 환경변수에 `.env.example`의 키 전부 등록
3. Cognito 사용자 풀 (이메일+비밀번호, 인증 코드 비활성) → `lib/auth.ts`의 TODO를 `aws-jwt-verify`로 구현

## GitHub 레포 연결

로컬 저장소는 이미 초기화되어 있고 첫 커밋(`chore: 프로젝트 초기 설정`)이 들어가 있다. 원격만 붙이면 된다.

**먼저 커밋 작성자를 본인으로 바꾼다.** 지금은 임시값(`isol-service` / `dev@example.com`)으로 커밋되어 있다.

```bash
git config --global user.name "본인 이름"
git config --global user.email "본인 GitHub 이메일"
git commit --amend --reset-author --no-edit
```

### 경우 1 — GitHub 레포를 아직 만들지 않았다

GitHub에서 새 레포를 만들 때 **README·.gitignore·라이선스를 추가하지 않는다**(빈 레포). 그다음:

```bash
git remote add origin https://github.com/<계정>/<레포>.git
git branch -M main
git push -u origin main
```

### 경우 2 — 이미 만들어둔 레포가 있는데 비어 있다

경우 1과 동일하다. 커밋이 하나도 없으면 그냥 push된다.

### 경우 3 — 이미 만들어둔 레포에 커밋이 있다 (README 등)

원격 내용을 가져와 합친다. 히스토리가 서로 무관하므로 옵션이 필요하다.

```bash
git remote add origin https://github.com/<계정>/<레포>.git
git fetch origin
git merge origin/main --allow-unrelated-histories
```

`README.md`나 `.gitignore`에서 충돌이 나면 **이 저장소 쪽 내용을 채택한다**(원격에 있던 것은 GitHub이 자동 생성한 껍데기다). 해결 후:

```bash
git add . && git commit && git push -u origin main
```

> 원격 히스토리를 버리고 덮어쓰는 방법(`git push --force`)도 있지만, 다른 사람이 이미 그 레포를 clone했거나 커밋을 올렸다면 그 작업이 복구 불가능하게 사라진다. 팀 전원이 아직 아무것도 올리지 않은 것을 확인한 경우에만 쓴다.

### 경우 4 — 이미 clone해둔 로컬 폴더가 따로 있다

`git merge`로 합치려 하지 말고 파일을 옮기는 쪽이 간단하다. clone한 폴더로 이 프로젝트의 파일 전부(`.git` 제외)를 복사하고, 그쪽에서 `npm install` 후 커밋한다.

### 연결 후

4명에게 알린다. 각자:

```bash
git clone <레포 URL>
cd <레포>
npm install
cp .env.example .env   # DATABASE_URL을 E에게 받아 채운다
git checkout -b feat/<자기 브랜치>
```

브랜치 5개(`feat/diagnosis` `feat/missions` `feat/pet` `feat/community` `feat/infra`)는 각자 만들어도 되고 E가 미리 만들어 push해도 된다.
