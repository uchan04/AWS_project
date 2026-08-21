// 소유자: E. 로그인·가입 화면이 쓰는 API 호출부. app/diagnosis/api.ts의 read<T>() 패턴을 그대로 쓴다.

type ApiBody<T> = { data?: T; error?: { code: string; message: string } }

async function read<T>(response: Response): Promise<T> {
  const body: ApiBody<T> = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "잠시 후 다시 시도해 주세요")
  }
  return body.data as T
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  await read<Record<string, never>>(response)
}

export async function signup(email: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  await read<Record<string, never>>(response)
}
