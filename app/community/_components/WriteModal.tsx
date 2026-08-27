"use client"

import { useRef, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import type { TypeCode } from "@prisma/client"
import { TRIBE } from "@/lib/types"
import { useModalA11y } from "@/app/components/useModalA11y"
import { CrisisNotice } from "@/app/components/CrisisNotice"
import { type GalleryTab } from "../_lib/gallery"
import { pickTopics } from "../_lib/topics"
import { TITLE_MAX, BODY_MAX, remaining } from "../_lib/limits"
import { CRISIS_BLOCKED_HOTLINE } from "../_lib/crisis"

// 전체 갤러리는 종족이 없어 TRIBE에 키가 없다. lib/types.ts는 A 소유 공유 파일이라
// 건드리지 않고, ChatPanel이 NEUTRAL_COLOR를 자기 파일에 둔 것과 같은 방식으로 여기 둔다.
const NEUTRAL_COLOR = "#9CA3AF"

/*
 * 글쓰기 버튼 배경(2026-08-26). **globals.css의 강조색을 그대로 가져온 값이다** —
 * `:focus-visible` 아웃라인과 `.skip-to-content`의 `background:#a9542a; color:#fff`가
 * 같은 색이라, 새 색을 만들지 않고 이미 있는 "채운 강조 + 흰 글자" 쌍을 재사용한다.
 * 값을 바꿔야 하면 globals.css와 함께 바꾼다(여기만 바꾸면 초점 표시와 어긋난다).
 *
 * **갤러리 색(tribeColor)을 따르지 않는다.** 전체 갤러리에서 tribeColor는 NEUTRAL_COLOR
 * 회색이라 화면에서 가장 약한 채움이 됐고(흰 글자 대비 2.2:1로 AA 미달), 바로 옆의
 * 검은 탭보다 눌러야 할 것으로 안 보인다는 피드백이 나왔다. 이 화면의 유일한 주요 액션은
 * 맥락과 무관하게 같은 세기여야 한다 — 지금 어느 갤러리인지는 탭과 배너가 이미 알린다.
 */
const WRITE_ACCENT = "#A9542A"

/*
 * 첨부 사진. 값은 발급 쪽(`lib/uploads.ts`)과 같아야 한다 — 여기서 거르는 것은 편의이고
 * **신뢰 경계는 서버다.** presign이 같은 타입·크기를 다시 검사하고, 저장 직전에
 * `isAttachableImageKey()`가 키를 한 번 더 본다.
 *
 * 화면에서 먼저 거르는 이유는 서버 왕복 없이 즉시 알려주는 편이 낫기 때문이다 —
 * 5MB짜리를 올려보고 나서 거절당하면 그 시간이 통째로 낭비된다.
 */
const ACCEPT_TYPES = ["image/jpeg", "image/png"]
const ACCEPT_ATTR = ACCEPT_TYPES.join(",")
const MAX_FILE_SIZE = 4 * 1024 * 1024

/** 업로드 결과. 실패를 예외가 아니라 값으로 돌려 호출부가 문구를 그대로 쓰게 한다. */
type UploadOutcome = { ok: true; s3Key: string } | { ok: false; message: string }

/**
 * @param myTypeCode 내 종족. 갤러리(gallery)와 다르다 — 전체 탭에서도 추천은 내 성향으로 뽑는다.
 *   진단 전이면 null이고, 그때는 종족을 타지 않는 ALL 문구로 떨어진다(resolveTopicKey).
 */
export function WriteModal({ gallery, myTypeCode }: { gallery: GalleryTab; myTypeCode: TypeCode | null }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 위기 안내. 두 갈래가 있고 화면이 서로 달라야 한다(_lib/crisis.ts).
  //   crisisSaved=false — blocksPosting()에 걸려 **저장되지 않았다.** 입력을 그대로 두고
  //     안내를 폼 위에 얹는다. 쓴 글이 사라지면 안내가 벌처럼 읽힌다
  //   crisisSaved=true  — 저장은 됐지만 걱정되는 신호가 있다(사별·보도·비유·회복 서사).
  //     글은 올라갔으므로 폼을 걷고 안내만 남긴다. 폼을 두면 안 올라간 것처럼 보인다
  const [crisisNotice, setCrisisNotice] = useState<string | null>(null)
  const [crisisSaved, setCrisisSaved] = useState(false)
  // 모달을 열 때 정한다. 입력 중에는 목록이 바뀌지 않는다.
  const [topics, setTopics] = useState<string[]>([])
  // 첨부 사진. 고른 파일은 **미리 올리지 않는다** — 글을 안 쓰고 닫으면 고아 객체가 쌓인다.
  // 실제 업로드는 "게시하기"를 누른 뒤 handleSubmit에서 한 번만 일어난다.
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  /*
   * 사진이 **다 올라간 뒤** 서버가 검열·가드레일 판정을 도는 구간(실측 2.2초).
   * 그때도 "사진 올리는 중…"이라고 말하면 이미 끝난 일을 하고 있다고 알리는 셈이다.
   *
   * uploading을 대체하지 않는다 — 두 단계가 서로 다른 구간이고, 사진이 없으면
   * 이 단계 자체가 없어야 한다(문구를 나누지 않고 지금 동작 그대로 둔다).
   */
  const [checking, setChecking] = useState(false)
  // presign이 500 UPLOAD_NOT_CONFIGURED를 주면 첨부만 잠근다. 글쓰기는 계속 된다.
  const [attachDisabled, setAttachDisabled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAll = gallery === "ALL"
  const tribeColor = isAll ? NEUTRAL_COLOR : TRIBE[gallery].colorHex

  // 주제 추천(SPEC 8절). 제목만 고른다.
  //
  // **더 이상 서버를 부르지 않는다.** 2026-08-25에 LLM 추천을 끄면서
  // GET /api/community/topics가 이 화면과 똑같은 상수(_lib/topics.ts)를 돌려주게 됐다.
  // 상수를 받으려고 왕복을 돌면 창이 열린 뒤 목록이 한 번 바뀌어 제목 칸이 밀린다.
  // 라우트는 그대로 둔다 — 같은 pickTopics()를 쓰므로 API로 받아도 결과는 같다.
  function loadTopics() {
    setTopics(pickTopics(gallery, myTypeCode))
  }

  // 같은 파일을 다시 고를 수 있게 값을 비운다. 안 비우면 change가 안 뜬다.
  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // objectURL은 만든 만큼 해제한다. 바꿔 끼울 때마다 이전 것을 먼저 놓는다.
  function replacePreview(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(next ? URL.createObjectURL(next) : null)
    setFile(next)
  }

  function clearFile() {
    replacePreview(null)
    resetFileInput()
  }

  function handlePickFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null
    if (!picked) return
    setError(null)

    if (!ACCEPT_TYPES.includes(picked.type)) {
      setError("JPG·PNG 이미지만 올릴 수 있어요")
      resetFileInput()
      return
    }
    if (picked.size > MAX_FILE_SIZE) {
      setError("파일 크기는 4MB 이하여야 해요")
      resetFileInput()
      return
    }

    replacePreview(picked)
  }

  /**
   * presign → PUT. 성공하면 s3Key를 돌려준다.
   *
   * 문구는 서버 응답(`error.message`)을 그대로 쓴다 — E가 이미 한국어 문장으로 써 뒀고,
   * 여기서 새로 지으면 같은 실패가 두 가지 말로 보인다. 예외는 UPLOAD_NOT_CONFIGURED 하나다.
   */
  async function uploadImage(picked: File): Promise<UploadOutcome> {
    const presignRes = await fetch("/api/upload/community/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: picked.type, fileSize: picked.size }),
    })
    const presignJson = await presignRes.json().catch(() => null)

    if (!presignJson || presignJson.error) {
      const code = presignJson?.error?.code
      // 설정 오류는 다시 눌러도 안 된다. 첨부 자체를 잠그고 글만 올릴 수 있게 둔다.
      if (code === "UPLOAD_NOT_CONFIGURED") {
        setAttachDisabled(true)
        clearFile()
        return { ok: false, message: "지금은 사진을 올릴 수 없어요. 글만 올려주세요." }
      }
      // TOO_MANY_ATTEMPTS 포함. **고른 파일은 그대로 둔다** — 재시도할 수 있어야 한다.
      return { ok: false, message: presignJson?.error?.message ?? "사진을 올리지 못했어요" }
    }

    const { uploadUrl, s3Key } = presignJson.data

    // 헤더는 Content-Type **하나만** 보낸다. 값은 presign에 보낸 contentType과 정확히 같아야
    // 한다 — 서명에 들어가 있어서 다른 헤더를 얹거나 값이 다르면 403이 난다.
    // FormData로 감싸지 않는다. 본문은 File 객체 그대로다.
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": picked.type },
      body: picked,
    })
    if (!putRes.ok) {
      return { ok: false, message: "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요" }
    }

    return { ok: true, s3Key }
  }

  function close() {
    setIsOpen(false)
    setTitle("")
    setBody("")
    clearFile()
    setError(null)
    setCrisisNotice(null)
    setCrisisSaved(false)
  }

  // Escape로 닫기 · 초점 가두기 · 닫을 때 "글 쓰기" 버튼으로 초점 되돌리기.
  // 초점은 제목 칸으로 보낸다 — 기본값이면 ✕ 버튼에 가서 열자마자 닫기가 눌리기 쉽다
  const titleRef = useRef<HTMLInputElement>(null)
  const boxRef = useModalA11y(close, isOpen, titleRef)

  async function handleSubmit() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    if (!trimmedTitle || !trimmedBody || pending) return

    setPending(true)
    setError(null)
    try {
      // 사진이 있으면 **먼저** 올린다. 실패하면 글도 올리지 않는다 —
      // 사진만 빠진 채 글이 올라가면 사용자는 무엇을 다시 해야 하는지 알 수 없다.
      let imageKey: string | null = null
      if (file) {
        setUploading(true)
        const outcome = await uploadImage(file)
        if (!outcome.ok) {
          setError(outcome.message)
          return
        }
        imageKey = outcome.s3Key
        // 여기서 S3 PUT은 끝났다. 남은 대기는 서버 판정이라 문구를 바꾼다.
        setUploading(false)
        setChecking(true)
      }

      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle, body: trimmedBody, galleryType: gallery, imageKey }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error.message)
        return
      }
      // 위기 신호면 **저장되지 않았다.** 창을 닫지 않고, 입력도 지우지 않는다.
      // 목록이 바뀐 것이 없으므로 refresh·재화 이벤트도 쏘지 않는다 — 쏘면 올라가지 않은 글
      // 때문에 목록이 새로 그려지고, 사용자는 자기 글을 찾다가 없는 것을 확인하게 된다.
      if (json.data?.crisisBlocked) {
        setCrisisSaved(false)
        setCrisisNotice(json.data.notice)
        return
      }

      router.refresh()
      window.dispatchEvent(new CustomEvent("user-stats-changed"))

      // 막지는 않았지만 걱정되는 신호가 있는 글. 글은 이미 올라갔고(위 refresh로 목록에
      // 보인다) 여기서 닫으면 안내가 뜨자마자 사라져 읽을 시간이 없다.
      if (json.data?.crisisNotice) {
        setCrisisSaved(true)
        setCrisisNotice(json.data.crisisNotice)
        return
      }

      close()
    } finally {
      setPending(false)
      setUploading(false)
      setChecking(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          loadTopics()
          setIsOpen(true)
        }}
        // 배경이 인라인 색(WRITE_ACCENT)이라 hover:bg-*로는 못 건드린다. 색과 무관한 그림자·이동·축소로 반응을 만든다.
        // 이동·확대만 motion-safe:로 감싼다 — prefers-reduced-motion에서도 그림자는 남아야 무엇을 누르는지 보인다.
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition duration-150 hover:shadow-lg focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none active:shadow-sm motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.02] motion-safe:focus-visible:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]"
        style={{ backgroundColor: WRITE_ACCENT }}
      >
        ✏️ 글 쓰기
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6" onClick={close}>
          <div
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-modal-title"
            tabIndex={-1}
            /*
             * 같은 폴더 PostDetailModal(278·360행)과 **같은 구조다.** 바깥은 높이를 제한하고
             * 넘침을 감추고, 본문만 스크롤한다. 두 모달이 서로 다르게 스크롤하면 한쪽만
             * 고쳐지는 날이 온다.
             *
             * 사진 미리보기(max-h-56 = 224px)가 붙으면서 내용이 화면보다 길어졌는데 스크롤이
             * 없어 "게시하기"가 화면 밖으로 나갔다 — 사진을 고르면 글을 올릴 수 없었다.
             * 첨부 UI를 붙이면서 생긴 회귀다.
             *
             * p-8을 컨테이너에서 떼어 머리·본문·바닥에 나눠 넣었다. 컨테이너에 두면
             * 스크롤바가 안쪽 여백 바깥에 생긴다. max-w-lg는 그대로다.
             */
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 머리: 스크롤하지 않는다. pt-8·px-8은 예전 컨테이너 p-8, pb-5는 예전 mb-5다 */}
            <div className="flex items-center justify-between px-8 pt-8 pb-5">
              <h2 id="write-modal-title" className="text-base font-bold text-ink">
                {crisisNotice
                  ? crisisSaved
                    ? "글이 올라갔어요"
                    : "잠깐 멈춰둘게요"
                  : isAll
                    ? "전체 커뮤니티에 글쓰기"
                    : `${TRIBE[gallery].animal} 갤러리에 글쓰기`}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="글쓰기 창 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-2 text-muted hover:bg-rule"
              >
                ✕
              </button>
            </div>

            {/* 본문: **여기만 스크롤한다.** 위기 안내·주제 추천·입력·글자 수·사진 첨부·에러가 들어간다.
                py-1·scroll-py-2는 **포커스 링 자리다(2026-08-26).** 화면에 보이는 초점 표시는
                입력이 가진 것이 아니라 globals.css의 `:focus-visible { outline: 2px; outline-offset: 2px }`이고
                (입력의 outline-none은 이걸 못 끈다 — 유틸리티는 @layer 안, 저 규칙은 레이어 밖이라 항상 이긴다),
                테두리 바깥으로 4px 튀어나온다. overflow-y-auto는 overflow-x도 auto로 만들어 padding box에서
                자르므로, 좌우는 px-8이 받아주지만 상하는 padding이 0이면 그 4px이 잘렸다.
                scroll-py-2는 포커스로 스크롤될 때 입력이 경계에 딱 붙지 않게 한다. */}
            <div className="flex-1 scroll-py-2 overflow-y-auto px-8 py-1">
            {/* 저장되지 않았을 때의 안내. **입력 폼을 걷어내지 않는다** — 쓴 글이 그대로 남아
                있어야 한다(_lib/crisis.ts 조건 2). 안내를 폼 위에 얹고, 아래 폼은 그대로 둔다.
                거절이 아니라 다른 길을 알려주는 자리다. */}
            {crisisNotice ? (
              <>
                <CrisisNotice message={crisisNotice} />
                {!crisisSaved && (
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    전화가 어렵게 느껴지면 아래 글은 그대로 두었다가 나중에 올려도 괜찮아요.
                    {CRISIS_BLOCKED_HOTLINE}번은 24시간 열려 있어요.
                  </p>
                )}
                {!crisisSaved && <div className="mt-4 mb-5 border-b border-rule" />}
              </>
            ) : null}

            {!crisisSaved && (
            <>
            {/* 주제 추천(SPEC 8절). 문구는 `_lib/topics.ts` 하나에서 온다.
                **제목만 채운다** — 본문을 대신 써 주면 그 문장이 그 사람의 하루를 규정한다. */}
            {topics.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-muted" role="status" aria-live="polite">
                  선택하면 제목이 채워져요
                </p>
                <div className="flex flex-col gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setTitle(topic)}
                      // 세로로 나열되므로 이동 효과는 넣지 않는다. 테두리 색만 진해져 "고를 수 있는 것"임을 드러낸다.
                      className="rounded-xl border border-rule px-4 py-2.5 text-left transition duration-150 hover:border-rule-hover hover:bg-paper focus-visible:border-rule-hover focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <span className="block text-sm font-semibold" style={{ color: tribeColor }}>
                        {topic}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* placeholder는 접근 가능한 이름이 아니다 — 입력하면 사라져 무슨 칸인지 알 수 없다 */}
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력해주세요"
              aria-label="제목"
              // maxLength는 UX다. 실제 거절은 서버(app/api/community/posts/route.ts)가 한다
              maxLength={TITLE_MAX}
              className="mb-1 w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-muted outline-none focus:border-rule-2"
            />
            {/* 제목은 100자를 쓸 일이 드물어 20자 남았을 때만 띄운다 — 늘 띄우면 잔소리가 된다 */}
            <p className="mb-2 h-4 text-right text-xs text-muted">
              {remaining(title, TITLE_MAX) <= 20 ? `${title.length} / ${TITLE_MAX}자` : ""}
            </p>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"오늘 있었던 일, 느낀 것을 이야기해봐요\n여기선 뭐든 괜찮아요."}
              aria-label="본문"
              rows={6}
              maxLength={BODY_MAX}
              className="mb-1 w-full resize-none rounded-xl border border-rule bg-paper px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-muted outline-none focus:border-rule-2"
            />
            {/* 본문은 길게 쓰다가 잘리면 놀란다. 늘 띄우고 200자 남으면 색을 바꾼다 */}
            <p
              className={`mb-3 text-right text-xs ${
                remaining(body, BODY_MAX) <= 200 ? "text-amber-600" : "text-muted"
              }`}
              aria-live="polite"
            >
              {body.length} / {BODY_MAX}자
            </p>

            {/* 사진 첨부(선택). 없어도 글은 올라간다.
                흐름은 "게시하기" → presign → uploadUrl에 PUT → 받은 s3Key를 글 POST의
                imageKey로. 고르는 시점에는 아무것도 올리지 않는다(고아 객체 방지). */}
            {attachDisabled ? (
              <p className="mb-3 text-xs text-muted">사진 첨부는 지금 이용할 수 없어요</p>
            ) : previewUrl ? (
              <div className="relative mb-3">
                {/* next/image를 쓰지 않는 이유는 목록 카드와 같다. 여기는 blob: URL이라 더 그렇다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="첨부한 사진 미리보기"
                  className="max-h-56 w-full rounded-xl border border-rule object-cover"
                />
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={pending}
                  className="absolute top-2 right-2 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-black/75 disabled:opacity-40"
                >
                  제거
                </button>
              </div>
            ) : (
              <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-rule px-4 py-3 text-xs text-muted transition hover:border-rule-hover hover:bg-paper">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_ATTR}
                  onChange={handlePickFile}
                  disabled={pending}
                  className="hidden"
                />
                📷 사진 첨부 · 선택 (JPG·PNG, 4MB 이하)
              </label>
            )}

            {error && (
              <p role="alert" className="mb-3 text-xs text-error">
                {error}
              </p>
            )}
            </>
            )}
            </div>

            {/* 바닥: **스크롤 영역 밖에 고정한다.** 사진을 붙이면 본문이 길어지는데 버튼이
                같이 밀려 내려가면 올릴 때마다 스크롤해서 찾아야 한다.
                위쪽 여백은 예전과 같다 — 앞 요소의 mb-3(12px)이 그대로 간격이 된다.
                pb-8은 예전 컨테이너 p-8의 아래쪽이다. */}
            {/* 위기 안내로 이미 올라간 뒤에는 폼이 없고 "닫기"만 남는다. 그것도 바닥 몫이다 —
                본문에 두면 모달 아래 모서리에 붙는다. pt-5는 예전 mt-5다 */}
            {crisisSaved && (
              <div className="flex justify-end px-8 pt-5 pb-8">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink transition hover:bg-accent-2"
                >
                  닫기
                </button>
              </div>
            )}

            {!crisisSaved && (
              <div className="flex justify-end px-8 pb-8">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending || uploading || !title.trim() || !body.trim()}
                  className="rounded-xl px-6 py-2.5 text-sm font-bold text-accent-ink transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: tribeColor }}
                >
                  {uploading ? "사진 올리는 중…" : checking ? "확인하는 중…" : "게시하기"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
