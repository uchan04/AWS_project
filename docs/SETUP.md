# 로컬 개발환경 구축 (Windows)

담당 D가 작성. 대상은 **아무것도 설치돼 있지 않은 Windows PC**다. Node·Git·PostgreSQL이 전부 없는 상태에서 시작해 `npm run dev`로 `http://localhost:3000`이 뜰 때까지를 다룬다.

- 대상: A·B·C (진단·미션·펫 담당)
- 소요 시간: 30~50분. 대부분 winget 다운로드 대기 시간이다
- 셸은 **PowerShell**을 쓴다. 아래 명령은 전부 PowerShell 기준이다

**범위 밖**: AWS 자격증명, Cognito, Bedrock, S3, Amplify 배포는 이 문서에서 다루지 않는다. `docs/dev/infra.md`를 본다. 로컬 개발은 `DEV_AUTH_BYPASS=true`로 AWS 없이 전부 돌아간다.

각 단계 끝에 **확인** 블록이 있다. 그 명령을 실행해 기대 출력이 나와야 다음 단계로 넘어간다. 안 나오면 문서 끝의 [문제 해결](#문제-해결)을 본다.

---

## 1. 툴체인 설치

winget으로 5개를 설치한다. PowerShell을 열고 한 줄씩 실행한다.

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id PostgreSQL.PostgreSQL.18 -e
winget install --id Microsoft.VisualStudioCode -e
winget install --id GitHub.cli -e
```

PostgreSQL 설치 중에 **슈퍼유저(`postgres`) 비밀번호를 정하라는 창**이 뜬다. 여기서 정한 비밀번호는 5단계와 6단계에서 다시 쓴다. 지금 적어둔다. 포트는 기본값 `5432` 그대로 둔다.

> **주의 — 열려 있던 PowerShell 창은 옛 PATH를 그대로 쓴다**
>
> winget이 설치를 끝내도 **이미 열려 있던 창**에는 새 PATH가 반영되지 않는다. 그 창에서 `git`이나 `node`를 치면 계속 "인식되지 않습니다"가 뜬다. 창을 닫고 **완전히 새 PowerShell 창을 연다.** 그래도 안 되면 로그아웃 후 다시 로그인한다.

**확인** — 새 PowerShell 창을 열고:

```powershell
git --version
node --version
npm --version
gh --version
```

기대 출력(버전 숫자는 달라도 된다):

```
git version 2.4x.x.windows.1
v22.x.x
10.x.x
gh version 2.x.x (...)
```

`node`는 **v20 이상**이어야 한다. 이 프로젝트는 Next.js 16을 쓴다.

---

## 2. Windows 초기 설정

### 2-1. PowerShell 실행 정책

기본 정책(`Restricted`)에서는 `npm.ps1`이 차단돼 `npm` 명령이 통째로 실패한다. 현재 사용자 범위로만 푼다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

확인 창이 뜨면 `Y`를 누른다. 관리자 권한은 필요 없다.

### 2-2. git 설정

이름과 이메일은 **본인 GitHub 계정 값**으로 넣는다. 아래는 자리표시자다.

```powershell
git config --global user.name "본인이름"
git config --global user.email "본인계정@example.com"
git config --global core.autocrlf true
git config --global init.defaultBranch main
```

`core.autocrlf true`는 Windows 줄바꿈(CRLF)과 저장소 줄바꿈(LF)을 자동 변환한다. 안 넣으면 남이 만든 파일을 열기만 해도 전체 줄이 바뀐 것처럼 보이는 diff가 나온다.

### 2-3. GitHub 로그인

```powershell
gh auth login
```

`GitHub.com` → `HTTPS` → `Login with a web browser`를 고른다. 화면에 뜨는 8자리 코드를 브라우저에 붙여넣는다.

**확인**:

```powershell
git config --global user.name
gh auth status
```

기대 출력:

```
본인이름
github.com
  ✓ Logged in to github.com account <계정명> (keyring)
  - Active account: true
```

---

## 3. 저장소 클론 및 브랜치 체크아웃

작업 폴더를 정해 그 안에서 클론한다. **경로에 한글이나 공백이 없는 곳**을 쓴다(`C:\dev` 등). 한글 경로는 일부 Node 도구에서 깨진다.

```powershell
mkdir C:\dev -Force
cd C:\dev
gh repo clone uchan04/AWS_project
cd AWS_project
```

담당별로 자기 브랜치를 체크아웃한다. **브랜치는 담당별로 고정이며 남의 브랜치에서 작업하지 않는다**(`CLAUDE.md` 4절).

| 담당 | 브랜치 | 명령 |
|---|---|---|
| A (진단·미션 콘텐츠·홈) | `feat/diagnosis` | `git checkout feat/diagnosis` |
| B (미션 시스템·사진 업로드) | `feat/missions` | `git checkout feat/missions` |
| C (펫·가챠) | `feat/pet` | `git checkout feat/pet` |

**확인**:

```powershell
git branch --show-current
git log -1 --oneline
```

기대 출력(커밋 해시는 다르다):

```
feat/diagnosis
xxxxxxx feat: ...
```

---

## 4. npm install

```powershell
npm install
```

`package.json`에 있는 것만 설치된다. **새 라이브러리를 임의로 추가하지 않는다**(`CLAUDE.md` 2절). 몇 분 걸린다.

이 프로젝트는 `postinstall` 스크립트가 걸려 있어서 설치가 끝나면 `prisma generate`가 자동으로 한 번 돈다. 아직 DB가 없어도 정상이다 — `prisma generate`는 스키마 파일만 읽고 DB에 접속하지 않는다.

> **주의 — `npm run dev`가 켜져 있으면 이 단계가 실패한다**
>
> 다른 창에서 개발 서버가 돌고 있으면 `postinstall`의 `prisma generate`가 `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`로 죽는다. Windows가 실행 중인 프로세스가 잡고 있는 DLL을 못 바꾸기 때문이다. 개발 서버를 끄고(`Ctrl+C`) 다시 `npm install`한다.

**확인**:

```powershell
npm ls next prisma
```

기대 출력:

```
isol-service@0.1.0 C:\dev\AWS_project
├── next@16.3.1
└── prisma@6.19.3
```

**Prisma는 6.x로 고정돼 있다.** 7로 올리지 않는다 — 7은 `prisma.config.ts`와 driver adapter가 필수라 설정 실패 지점이 늘어난다(`docs/dev/infra.md`).

---

## 5. PostgreSQL 데이터베이스 생성

로컬에 `welli` 데이터베이스를 만든다. 이름은 `.env.example`의 `DATABASE_URL`과 맞춰야 한다.

### 5-1. psql PATH 등록

PostgreSQL 설치 관리자는 `psql`을 PATH에 넣어주지 않는 경우가 많다. 먼저 확인한다.

```powershell
psql --version
```

`psql (PostgreSQL) 18.x`가 나오면 5-2로 넘어간다. "인식되지 않습니다"가 나오면 PATH에 넣는다.

> **주의 — `$env:Path` 에 더하는 방식은 그 창에서만 살아있다**
>
> 아래처럼 쓰면 편하지만 **창을 닫는 순간 사라진다.** 다음에 새 창을 열면 또 `psql`을 못 찾는다.
>
> ```powershell
> # 이번 창에서만 유효 — 영구 등록이 아니다
> $env:Path += ";C:\Program Files\PostgreSQL\18\bin"
> ```
>
> 영구 등록은 `[Environment]::SetEnvironmentVariable`을 쓴다. **범위는 `"User"`를 쓴다** — `"Machine"`은 관리자 권한이 필요하고 PC 전체에 영향을 준다.
>
> ```powershell
> $pg = "C:\Program Files\PostgreSQL\18\bin"
> $old = [Environment]::GetEnvironmentVariable("Path", "User")
> [Environment]::SetEnvironmentVariable("Path", "$old;$pg", "User")
> ```
>
> 등록 후에는 **새 PowerShell 창을 연다.** 1단계와 같은 이유로 지금 창에는 반영되지 않는다.

### 5-2. 데이터베이스 생성

```powershell
psql -U postgres -c "CREATE DATABASE welli;"
```

1단계에서 정한 `postgres` 비밀번호를 묻는다.

> **주의 — 비밀번호는 화면에 아무것도 안 찍힌다**
>
> `Password for user postgres:` 뒤에 타이핑해도 `*`조차 표시되지 않는다. 정상이다. 지웠다 다시 치지 말고 그냥 끝까지 입력하고 Enter를 누른다.
>
> **한/영 키가 한글 모드면 반드시 실패한다.** 화면에 표시가 없으니 한글로 입력되고 있다는 걸 알 수 없고, `password authentication failed for user "postgres"`만 뜬다. 입력 전에 한/영 키를 눌러 **영문 모드**인지 확인한다. Caps Lock도 같이 확인한다.

### 5-3. 비밀번호를 잊었을 때

세 번 이상 틀리면 여기로 온다. `pg_hba.conf`를 잠깐 `trust`로 바꿔 비밀번호 없이 들어간 뒤 재설정한다.

> **경고 — 이 절차는 DB를 비밀번호 없이 누구나 접속 가능한 상태로 만든다. 4번의 원복까지 반드시 한 번에 끝낸다.**

1. `C:\Program Files\PostgreSQL\18\data\pg_hba.conf`를 관리자 권한 편집기로 연다. 파일 아래쪽 `host all all 127.0.0.1/32 scram-sha-256` 줄의 마지막 값을 `trust`로 바꾼다. `::1/128` 줄도 같이 바꾼다

2. 서비스를 재시작한다 (**관리자 권한 PowerShell**)

   ```powershell
   Restart-Service postgresql-x64-18
   ```

3. 비밀번호 없이 접속해 새 비밀번호를 넣는다. `새비밀번호`는 자리표시자다

   ```powershell
   psql -U postgres -c "ALTER USER postgres WITH PASSWORD '새비밀번호';"
   ```

4. **`pg_hba.conf`를 원복한다.** `trust`로 바꾼 두 줄을 전부 `scram-sha-256`으로 되돌리고 다시 재시작한다

   ```powershell
   Restart-Service postgresql-x64-18
   ```

   **원복하지 않으면 비밀번호 없이 DB에 접속할 수 있는 상태로 남는다.** 로컬이라도 그대로 두지 않는다. 원복이 됐는지는 아래 확인 명령이 비밀번호를 묻는지로 판단한다 — 안 물으면 아직 `trust`다.

**확인**:

```powershell
psql -U postgres -l
```

비밀번호를 물은 뒤, 목록에 `welli`가 있어야 한다.

```
                          List of databases
   Name    |  Owner   | Encoding |  Collate   |   Ctype    | ...
-----------+----------+----------+------------+------------+----
 postgres  | postgres | UTF8     | ...
 welli     | postgres | UTF8     | ...
 template0 | postgres | UTF8     | ...
 template1 | postgres | UTF8     | ...
```

---

## 6. `.env` 작성

`.env.example`을 복사해서 `.env`를 만든다. `.env`는 커밋되지 않는다.

```powershell
Copy-Item .env.example .env
```

`.env`를 열어 **`DATABASE_URL` 한 줄만** 로컬 값으로 고친다. 나머지 키는 `.env.example`에 있는 그대로 둔다.

```
DATABASE_URL="postgresql://postgres:본인이정한비밀번호@localhost:5432/welli?schema=public"
```

- `postgres` — 5단계에서 쓴 슈퍼유저 이름
- `본인이정한비밀번호` — 1단계 PostgreSQL 설치 때 정한 값. 자리표시자다
- `welli` — 5단계에서 만든 DB 이름. `.env.example`과 같아야 한다
- `?schema=public` — 빼지 않는다

비밀번호에 `@` `:` `/` `#` 같은 문자가 있으면 URL 인코딩해야 한다(`@`는 `%40`). 이런 문자를 안 쓰는 비밀번호로 바꾸는 편이 빠르다.

`DEV_AUTH_BYPASS`는 `.env.example`에 이미 `"true"`로 들어 있다. **그대로 둔다.** 이 값이 `true`여야 `lib/auth.ts`가 Cognito 검증을 건너뛰고 고정 개발 계정을 반환해서, AWS 자격증명 없이 모든 API를 호출할 수 있다.

`COGNITO_*` `BEDROCK_*` `S3_BUCKET`은 **빈 값으로 둔다.** 실제 값이 필요해지면(사진 업로드·챗봇 작업 시) E에게 개별로 받는다. 절차는 `docs/dev/infra.md`.

`CLOUDFRONT_DOMAIN`은 **아무 코드도 읽지 않는다**(2026-08-22). 펫·치장 그림 30장은 `public/art/` 아래에 구워져 있고 `lib/assets.ts`가 거기서 읽는다. 키를 지우지는 않았다 — `amplify.yml`이 아직 목록에 갖고 있다.

> **주의 — `.env`를 커밋하지 않는다**
>
> `git add .` 전에 `git status`로 `.env`가 목록에 없는지 한 번 본다. 실제 DB 비밀번호가 저장소에 올라가면 되돌리기 어렵다.

**확인**:

```powershell
Select-String -Path .env -Pattern "^DATABASE_URL"
```

기대 출력(비밀번호 부분은 본인 값):

```
.env:5:DATABASE_URL="postgresql://postgres:***@localhost:5432/welli?schema=public"
```

---

## 7. 마이그레이션 적용

**`npx prisma migrate deploy`만 쓴다.** 저장소에 이미 마이그레이션 2개가 들어 있고, 이걸 그대로 로컬 DB에 적용하는 것이 목적이다.

```
prisma/migrations/
├── 20260819061857_init/
├── 20260819080703_add_subtype/
└── migration_lock.toml
```

```powershell
npx prisma migrate deploy
npx prisma generate
```

두 줄을 합친 npm 스크립트도 있다. 아래 한 줄이 위 두 줄과 완전히 같다.

```powershell
npm run db:push
```

> **주의 — `npm run db:push`는 `prisma db push`가 아니다**
>
> 이름만 보면 `prisma db push`를 부를 것 같지만, `package.json`의 실제 정의는 `prisma migrate deploy && prisma generate`다. **`db:push`는 안전하다.** 위험한 건 아래의 맨손 `prisma db push`다.

> **주의 — `npx prisma db push`를 먼저 실행하면 이후가 전부 막힌다**
>
> `db push`는 마이그레이션 기록 없이 스키마만 DB에 밀어 넣는다. 그러면 DB에 테이블은 있는데 마이그레이션 이력 테이블은 비어 있는 상태가 되고, 다음에 `migrate deploy`를 돌리면 이렇게 죽는다.
>
> ```
> Error: P3005
> The database schema is not empty.
> ```
>
> 이 상태를 푸는 건 baseline 작업이라 번거롭다. **처음부터 `migrate deploy`만 쓴다.**

> **주의 — `npm run dev`가 켜져 있으면 `prisma generate`가 실패한다**
>
> 4단계와 같은 원인이다. 개발 서버가 Prisma 쿼리 엔진 DLL을 잡고 있어서 교체가 안 되고 `EPERM: operation not permitted, rename ...`이 난다. 개발 서버를 `Ctrl+C`로 끄고 실행한다.

> **주의 — `CLAUDE.md` 5절: 아래 두 명령은 실행하지 않는다**
>
> - `npx prisma migrate dev` — **스키마 담당 1인만** 실행한다. 여러 명이 각자 돌리면 마이그레이션 히스토리가 갈라져 병합이 불가능해진다. 스키마를 바꿔야 하면 담당자에게 요청한다
> - `npx prisma migrate reset` — **절대 실행하지 않는다.** 공유 DB의 모든 데이터가 삭제된다. 로컬 초기화가 필요하면 먼저 팀에 알린다
>
> 나중에 "스키마가 바뀌었다"는 공지를 받으면 이것만 실행한다.
>
> ```powershell
> git pull
> npx prisma migrate deploy
> npx prisma generate
> ```

**확인**:

```powershell
npx prisma migrate status
```

기대 출력:

```
2 migrations found in prisma/migrations

Database schema is up to date!
```

---

## 8. 시드 데이터

미션 콘텐츠와 펫·치장 아이템을 DB에 넣는다.

```powershell
npm run db:seed
```

기대 출력(개수는 시드 내용에 따라 달라진다. **마지막 줄 `seed 완료`가 성공 신호**다):

```
펫·캐릭터 N종, 치장 M종 반영
미션 N개 반영
seed 완료
```

시드는 `upsert`라서 **여러 번 돌려도 안전하다.** 중복 행이 생기지 않고 기존 행이 갱신된다.

> **주의 — 시드 실행 전에 `prisma/seed/items.ts` 상태를 확인한다**
>
> 이 파일의 동물 매핑이 옛 값이면 뒤바뀐 데이터가 그대로 DB에 들어간다. 현재 상태는 `docs/STATUS.md`의 "전체 차단 사항"을 본다. 담당은 C이며, **다른 담당자가 이 파일을 고치지 않는다**(`CLAUDE.md` 2절).

**확인**:

```powershell
psql -U postgres -d welli -c "SELECT COUNT(*) FROM \"Mission\";"
```

기대 출력(숫자는 시드 내용에 따라 다르며, **0이 아니면 성공**이다):

```
 count
-------
    41
(1 row)
```

테이블 이름의 큰따옴표를 빼면 안 된다. Prisma가 만든 테이블은 대문자로 시작해서 따옴표 없이는 못 찾는다.

---

## 9. 개발 서버 실행

```powershell
npm run dev
```

기대 출력:

```
> isol-service@0.1.0 dev
> next dev

  ▲ Next.js 16.3.1
  - Local:        http://localhost:3000

 ✓ Ready in 2.1s
```

브라우저에서 `http://localhost:3000`을 연다. 첫 접속은 컴파일 때문에 몇 초 걸린다.

서버를 끌 때는 이 창에서 `Ctrl+C`를 누른다. **4단계·7단계의 `prisma generate`를 다시 돌려야 할 때는 반드시 먼저 꺼야 한다.**

**확인** — 서버를 켜 둔 채 **다른** PowerShell 창에서:

```powershell
curl.exe -s http://localhost:3000/api/diagnosis/me
```

기대 출력은 아래 둘 중 하나다. **둘 다 정상**이다 — 인증이 통과했고 DB 조회까지 도달했다는 뜻이다.

```
{"data":{...}}
```

```
{"error":{"code":"...","message":"..."}}
```

`{"error":{"code":"UNAUTHORIZED",...}}`가 나오면 `.env`의 `DEV_AUTH_BYPASS`가 `"true"`가 아니다. 6단계를 다시 본다.

---

## 마지막 점검

여기까지 왔으면 아래가 전부 참이어야 한다.

- [ ] `node --version`이 v20 이상
- [ ] `git branch --show-current`가 본인 담당 브랜치
- [ ] `npx prisma migrate status`가 `Database schema is up to date!`
- [ ] `npm run db:seed`가 `seed 완료`로 끝남
- [ ] `http://localhost:3000`이 열림
- [ ] `git status`에 `.env`가 **없음**
- [ ] (5-3을 했다면) `pg_hba.conf`가 `scram-sha-256`으로 원복됨

다음은 `docs/STATUS.md` → 본인 담당 `docs/dev/<기능>.md` 순으로 읽고 작업을 시작한다.

---

## 문제 해결

| 증상 (실제 에러 메시지) | 원인 | 해결 |
|---|---|---|
| `'git' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다` (`node`·`npm`·`gh`도 동일) | winget 설치 전부터 열려 있던 PowerShell 창이라 옛 PATH를 쓰고 있다 | 창을 닫고 **새 PowerShell 창**을 연다. 그래도 안 되면 로그아웃 후 재로그인 (1단계) |
| `'psql' ... 인식되지 않습니다` | PostgreSQL 설치 관리자가 `bin`을 PATH에 넣지 않았다 | `[Environment]::SetEnvironmentVariable("Path", "$old;C:\Program Files\PostgreSQL\18\bin", "User")` 후 새 창 (5-1) |
| 새 창을 열면 다시 `'psql' ... 인식되지 않습니다` | `$env:Path` 에 더하는 방식으로 넣어서 그 창에서만 유효했다 | 위와 같이 `"User"` 범위로 영구 등록한다 (5-1) |
| `이 시스템에서 스크립트를 실행할 수 없으므로 ... npm.ps1 파일을 로드할 수 없습니다` | PowerShell 실행 정책이 `Restricted` | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (2-1) |
| `psql: error: ... FATAL: password authentication failed for user "postgres"` | 비밀번호 오타. 화면에 표시가 없어서 한/영 모드가 한글이면 알 수 없다 | 한/영 키를 **영문**으로, Caps Lock 확인 후 재입력. 잊었으면 5-3의 재설정 절차 (5-2) |
| 5-3 후 `psql -U postgres`가 비밀번호를 **안 묻는다** | `pg_hba.conf`가 아직 `trust`다. 비밀번호 없이 DB에 들어갈 수 있는 상태 | 두 줄을 `scram-sha-256`으로 원복하고 `Restart-Service postgresql-x64-18` (5-3 4번) |
| `Error: P1001: Can't reach database server at localhost:5432` | PostgreSQL 서비스가 꺼져 있거나 포트가 다르다 | `Get-Service postgresql*`로 상태 확인 후 `Start-Service postgresql-x64-18` |
| `Error: P1003: Database welli does not exist` | 5단계를 건너뛰었거나 DB 이름 오타 | `psql -U postgres -c "CREATE DATABASE welli;"` (5-2). `.env`의 이름도 `welli`인지 확인 |
| `Environment variable not found: DATABASE_URL` | `.env`가 없거나 프로젝트 루트가 아닌 곳에서 실행했다 | `Copy-Item .env.example .env` 후 값 입력. `AWS_project` 폴더에서 실행 (6단계) |
| `Error: P3005 The database schema is not empty` | `prisma db push`를 먼저 돌려서 테이블만 있고 마이그레이션 기록이 없다 | 처음부터 `migrate deploy`만 써야 한다. 이미 이 상태면 팀에 알린다 — `migrate reset`은 금지다 (7단계) |
| `EPERM: operation not permitted, rename ... query_engine-windows.dll.node` | `npm run dev`가 켜져 있어 쿼리 엔진 DLL이 잠겨 있다 | 개발 서버 창에서 `Ctrl+C`로 종료 후 재실행 (4·7단계) |
| `npm run db:push`가 `db push`를 부를까 봐 못 쓰겠다 | 이름 오해. 실제 정의는 `prisma migrate deploy && prisma generate`다 | 그대로 써도 된다. 위험한 건 맨손 `npx prisma db push`다 (7단계) |
| `Port 3000 is in use, using available port 3001 instead` | 다른 창에 `npm run dev`가 이미 떠 있다 | 기존 창을 끄거나 안내된 포트로 접속한다 |
| `{"error":{"code":"UNAUTHORIZED",...}}` | `.env`의 `DEV_AUTH_BYPASS`가 `"true"`가 아니다 | `.env`에서 `DEV_AUTH_BYPASS="true"` 확인 후 개발 서버 재시작 (6단계) |
| `npm install`이 새 패키지를 추가하라고 안내한다 | 의존성 추가는 금지다 | `package.json`에 있는 것으로 해결한다. 정말 필요하면 팀에 이유부터 설명한다 (`CLAUDE.md` 2절) |
