// 소유자: A. 일회성 자산 도구 — 원본 스프라이트 시트를 개별 PNG으로 자른다.
//
// 왜 이게 필요한가: S3에 펫·배경 이미지가 올라와 있다고 문서에는 적혀 있지만
// CloudFront가 모든 경로에 403을 준다(2026-08-22 실측). 원화는 레포 루트에 시트 3장으로
// 있고, 필요한 30장이 그 안에 전부 들어 있다. 그래서 시트를 잘라 public/art에 굽는다.
// 이렇게 하면 S3·CloudFront·IAM 자격증명 없이도 화면에 실제 그림이 뜬다.
//
// 새 의존성을 쓰지 않는다(CLAUDE.md). PNG 디코딩은 Node 내장 zlib으로 직접 한다 —
// sharp·jimp를 넣으면 Amplify 빌드에 네이티브 모듈이 끼어든다.
//
// 실행: npx tsx scripts/slice-art.ts
// 결과물은 커밋한다. 이 스크립트를 CI·빌드에 끼워 넣지 않는다(원본 시트는 배포에 안 올린다).

import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { deflateSync, inflateSync } from "node:zlib"

const ROOT = join(import.meta.dirname, "..")
const OUT = join(ROOT, "public", "art")

// ── PNG 디코딩 ────────────────────────────────────────────────────────────────

type Bitmap = { width: number; height: number; rgba: Buffer }

/**
 * 8비트 RGB/RGBA·인터레이스 없음만 읽는다. 원본 시트 3장이 전부 그 형식이다.
 * 그 밖의 형식이 들어오면 조용히 이상한 그림을 굽지 않고 즉시 throw한다.
 */
function decodePng(file: Buffer): Bitmap {
  if (file.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 시그니처가 아니다")

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []

  let offset = 8
  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString("ascii", offset + 4, offset + 8)
    const data = file.subarray(offset + 8, offset + 8 + length)

    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (data[12] !== 0) throw new Error("인터레이스 PNG는 지원하지 않는다")
    } else if (type === "IDAT") {
      idat.push(data)
    } else if (type === "IEND") {
      break
    }

    offset += 12 + length
  }

  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth}는 지원하지 않는다`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (channels === 0) throw new Error(`colorType ${colorType}는 지원하지 않는다`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const rgba = Buffer.alloc(width * height * 4)
  // 언필터는 직전 스캔라인을 참조하므로 필터 해제된 바이트를 따로 들고 간다
  const cur = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    raw.copy(cur, 0, rowStart + 1, rowStart + 1 + stride)

    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      switch (filter) {
        case 0:
          break
        case 1:
          cur[i] = (cur[i] + a) & 0xff
          break
        case 2:
          cur[i] = (cur[i] + b) & 0xff
          break
        case 3:
          cur[i] = (cur[i] + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          // Paeth
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
          break
        }
        default:
          throw new Error(`알 수 없는 필터 ${filter}`)
      }
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * channels
      const dst = (y * width + x) * 4
      rgba[dst] = cur[src]
      rgba[dst + 1] = cur[src + 1]
      rgba[dst + 2] = cur[src + 2]
      rgba[dst + 3] = channels === 4 ? cur[src + 3] : 255
    }

    cur.copy(prev)
  }

  return { width, height, rgba }
}

// ── PNG 인코딩 ────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, tail])
}

/**
 * 필터 0(None) 고정으로 굽는다. 필터를 고르면 파일이 20~30% 작아지지만
 * 여기서 만드는 것은 300~600KB짜리 30장이고, next/image가 어차피 webp로 다시 굽는다.
 * 압축 레벨만 최대로 올려 둔다.
 */
function encodePng({ width, height, rgba }: Bitmap): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bitDepth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function crop(src: Bitmap, x0: number, y0: number, w: number, h: number): Bitmap {
  const rgba = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    const from = ((y0 + y) * src.width + x0) * 4
    src.rgba.copy(rgba, y * w * 4, from, from + w * 4)
  }
  return { width: w, height: h, rgba }
}

/**
 * 시트 셀은 종이색 판 위에 그림이 하나 놓인 구조다. 판 색과 눈에 띄게 다른 픽셀만
 * 남기고 사방 여백을 잘라낸다 — 셀 격자를 손으로 재면 그림 크기가 셀마다 달라
 * 어떤 것은 작게, 어떤 것은 잘려 보인다.
 *
 * 배경색은 셀 네 귀퉁이의 중앙값으로 잡는다. 귀퉁이에 그림이 걸치는 셀은 없다.
 */
function trimToContent(cell: Bitmap, tolerance = 26, pad = 8): Bitmap {
  const at = (x: number, y: number) => (y * cell.width + x) * 4
  const corners = [
    at(2, 2),
    at(cell.width - 3, 2),
    at(2, cell.height - 3),
    at(cell.width - 3, cell.height - 3),
  ]
  const bg = [0, 1, 2].map((c) => {
    const values = corners.map((i) => cell.rgba[i + c]).sort((a, b) => a - b)
    return (values[1] + values[2]) / 2
  })

  let minX = cell.width
  let minY = cell.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < cell.height; y += 1) {
    for (let x = 0; x < cell.width; x += 1) {
      const i = at(x, y)
      if (cell.rgba[i + 3] < 8) continue
      const diff =
        Math.abs(cell.rgba[i] - bg[0]) + Math.abs(cell.rgba[i + 1] - bg[1]) + Math.abs(cell.rgba[i + 2] - bg[2])
      if (diff <= tolerance) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  // 내용이 없다고 판정되면 자르지 않는다. 빈 PNG를 굽는 것이 최악이다
  if (maxX < 0) return cell

  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const x1 = Math.min(cell.width - 1, maxX + pad)
  const y1 = Math.min(cell.height - 1, maxY + pad)
  return crop(cell, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
}

function write(relPath: string, bitmap: Bitmap) {
  const target = join(OUT, relPath)
  mkdirSync(dirname(target), { recursive: true })
  const png = encodePng(bitmap)
  writeFileSync(target, png)
  const hash = createHash("sha1").update(png).digest("hex").slice(0, 8)
  console.log(
    `  ${relPath.padEnd(30)} ${String(bitmap.width).padStart(4)}x${String(bitmap.height).padStart(4)}  ` +
      `${(png.length / 1024).toFixed(0).padStart(4)}KB  ${hash}`,
  )
}

// ── 시트 레이아웃 ─────────────────────────────────────────────────────────────
//
// 좌표는 원본 픽셀 기준으로 눈으로 재고, 실제 그림 경계는 trimToContent가 다시 잡는다.
// 그래서 여기 숫자는 "셀 안쪽 어딘가"만 맞으면 되고 정밀할 필요가 없다.
// 단계 라벨 띠(위)와 종족 라벨 열(왼쪽)은 격자 밖으로 밀어 두어 글자가 섞이지 않게 한다.

/** 성장단계 시트 두 장은 레이아웃이 같다. 1536x1024, 3행(종족) x 4열(단계) */
const GROWTH = {
  rows: [
    { y: 155, h: 272 }, // 1행
    { y: 450, h: 268 }, // 2행
    { y: 740, h: 268 }, // 3행
  ],
  cols: [
    { x: 190, w: 296 }, // 1단계 알
    { x: 502, w: 290 }, // 2단계 아기
    { x: 808, w: 294 }, // 3단계 청소년
    { x: 1116, w: 380 }, // 4단계 성체
  ],
}

/** 배경 시트. 1619x971, 2열 x 3행. 셀 사이가 흰 여백이라 넉넉히 안쪽으로 잡는다 */
const BACKDROPS = {
  rows: [
    { y: 20, h: 286 },
    { y: 342, h: 288 },
    { y: 662, h: 288 },
  ],
  cols: [
    { x: 24, w: 770 },
    { x: 824, w: 770 },
  ],
}

// 시트의 행 순서 = 아래 배열 순서. prisma/seed/items.ts의 imageKeyBase와 이름을 맞춘다.
const GROWTH_SHEETS = [
  { file: "여우, 고양이, 곰 기본 성장단계.png", bases: ["fox", "bear", "cat"] },
  { file: "북극여우, 북극고양이, 북극곰 성장단계.png", bases: ["fox-arctic", "bear-arctic", "cat-arctic"] },
]

function main() {
  console.log("펫 성장단계 — 3종 x 4단")
  for (const sheet of GROWTH_SHEETS) {
    const bitmap = decodePng(readFileSync(join(ROOT, sheet.file)))
    if (bitmap.width !== 1536 || bitmap.height !== 1024) {
      throw new Error(`${sheet.file}의 크기가 1536x1024가 아니다 — 좌표표를 다시 재야 한다`)
    }
    sheet.bases.forEach((base, row) => {
      const { y, h } = GROWTH.rows[row]
      GROWTH.cols.forEach(({ x, w }, col) => {
        write(`pets/${base}-${col + 1}.png`, trimToContent(crop(bitmap, x, y, w, h)))
      })
    })
  }

  console.log("치장 배경 — 6종")
  const backdrop = decodePng(readFileSync(join(ROOT, "배경 이미지 바리에이션.png")))
  if (backdrop.width !== 1619 || backdrop.height !== 971) {
    throw new Error("배경 시트의 크기가 1619x971이 아니다 — 좌표표를 다시 재야 한다")
  }
  let n = 0
  for (const { y, h } of BACKDROPS.rows) {
    for (const { x, w } of BACKDROPS.cols) {
      n += 1
      // 배경은 셀을 꽉 채우는 풍경이다. 여백 잘라내기를 쓰면 하늘 위쪽이 날아간다
      write(`cosmetics/bg-${n}.png`, crop(backdrop, x, y, w, h))
    }
  }

  console.log(`\n완료 — public/art 아래 ${GROWTH_SHEETS.length * 12 + n}장`)
}

main()
