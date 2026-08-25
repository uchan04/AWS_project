"use client"

import { useRef, useState } from "react"
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

  function close() {
    setIsOpen(false)
    setTitle("")
    setBody("")
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
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle, body: trimmedBody, galleryType: gallery }),
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
        // 배경이 종족 색(인라인)이라 hover:bg-*로는 못 건드린다. 색과 무관한 그림자·이동·축소로 반응을 만든다.
        // 이동·확대만 motion-safe:로 감싼다 — prefers-reduced-motion에서도 그림자는 남아야 무엇을 누르는지 보인다.
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:shadow-lg focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none active:shadow-sm motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.02] motion-safe:focus-visible:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]"
        style={{ backgroundColor: tribeColor }}
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
            className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="write-modal-title" className="text-base font-bold text-neutral-900">
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {/* 저장되지 않았을 때의 안내. **입력 폼을 걷어내지 않는다** — 쓴 글이 그대로 남아
                있어야 한다(_lib/crisis.ts 조건 2). 안내를 폼 위에 얹고, 아래 폼은 그대로 둔다.
                거절이 아니라 다른 길을 알려주는 자리다. */}
            {crisisNotice ? (
              <>
                <CrisisNotice message={crisisNotice} />
                {!crisisSaved && (
                  <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                    전화가 어렵게 느껴지면 아래 글은 그대로 두었다가 나중에 올려도 괜찮아요.
                    {CRISIS_BLOCKED_HOTLINE}번은 24시간 열려 있어요.
                  </p>
                )}
                {!crisisSaved && <div className="mt-4 mb-5 border-b border-neutral-200" />}
                {crisisSaved && (
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-xl bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-700"
                    >
                      닫기
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {!crisisSaved && (
            <>
            {/* 주제 추천(SPEC 8절). 문구는 `_lib/topics.ts` 하나에서 온다.
                **제목만 채운다** — 본문을 대신 써 주면 그 문장이 그 사람의 하루를 규정한다. */}
            {topics.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-neutral-400" role="status" aria-live="polite">
                  선택하면 제목이 채워져요
                </p>
                <div className="flex flex-col gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setTitle(topic)}
                      // 세로로 나열되므로 이동 효과는 넣지 않는다. 테두리 색만 진해져 "고를 수 있는 것"임을 드러낸다.
                      className="rounded-xl border border-neutral-200 px-4 py-2.5 text-left transition duration-150 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:border-neutral-400 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:outline-none"
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
              className="mb-1 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
            />
            {/* 제목은 100자를 쓸 일이 드물어 20자 남았을 때만 띄운다 — 늘 띄우면 잔소리가 된다 */}
            <p className="mb-2 h-4 text-right text-xs text-neutral-400">
              {remaining(title, TITLE_MAX) <= 20 ? `${title.length} / ${TITLE_MAX}자` : ""}
            </p>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"오늘 있었던 일, 느낀 것을 이야기해봐요\n여기선 뭐든 괜찮아요."}
              aria-label="본문"
              rows={6}
              maxLength={BODY_MAX}
              className="mb-1 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-500"
            />
            {/* 본문은 길게 쓰다가 잘리면 놀란다. 늘 띄우고 200자 남으면 색을 바꾼다 */}
            <p
              className={`mb-3 text-right text-xs ${
                remaining(body, BODY_MAX) <= 200 ? "text-amber-600" : "text-neutral-400"
              }`}
              aria-live="polite"
            >
              {body.length} / {BODY_MAX}자
            </p>

            {error && (
              <p role="alert" className="mb-3 text-xs text-red-500">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || !title.trim() || !body.trim()}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: tribeColor }}
              >
                게시하기
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
