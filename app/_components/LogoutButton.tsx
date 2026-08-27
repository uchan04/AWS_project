"use client"

export function LogoutButton() {
  return (
    <button
      type="button"
      className="hm-link"
      onClick={() => {
        if (!confirm("로그아웃하시겠습니까?")) return
        void fetch("/api/auth/logout", { method: "POST", redirect: "manual" }).finally(() => {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/login"
        })
      }}
    >
      로그아웃
    </button>
  )
}
