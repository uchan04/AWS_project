// 씨앗·친밀도·별조각 세 재화가 화면마다 이모지를 따로 썼다(🌱/💖·❤️/⭐). 2026-08-26
// 모꼬지 에셋으로 교체하면서 출처를 한 곳으로 모았다 — 복사해 두면 다음 교체 때
// 한 곳만 고쳐도 나머지가 조용히 어긋난다(lib/assets.ts가 같은 이유로 이미 있다).
const CURRENCY_ICON: Record<"seed" | "affinity" | "starShard", string> = {
  seed: "/images/currency_seed.png",
  affinity: "/images/currency_affinity.png",
  starShard: "/images/currency_starshard.png",
}

export function CurrencyIcon({
  currency,
  size = 16,
}: {
  currency: "seed" | "affinity" | "starShard"
  size?: number
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CURRENCY_ICON[currency]}
      alt=""
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "-0.15em", objectFit: "contain", flexShrink: 0 }}
    />
  )
}
