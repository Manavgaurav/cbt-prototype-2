'use client'

import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist'

/**
 * Isolated auto-cropping utility for exam question papers.
 *
 * The PDF is rendered page by page to a high resolution canvas and question
 * boundaries are located purely from text positions. Each question is then
 * extracted as a full-width horizontal strip of the rendered page, so
 * formulas, chemical structures, diagrams and options survive untouched as
 * pixels (no OCR / text reconstruction is involved).
 */

export const QUESTION_MARKER_REGEX = /^(?:Q(?:uestion)?\.?\s*\d+|\b\d+\s*[\.\)])/i

export const AUTO_CROP_SCALE = 2.0

/** Vertical padding (in canvas pixels) kept above/below a question strip. */
const SLICE_PADDING = 12

/** Text lines closer than this (canvas px) are treated as the same line. */
const LINE_TOLERANCE = 4

/** A pixel darker than this (0-255, per channel) counts as ink. */
const INK_THRESHOLD = 245

export interface AutoCropResult {
  dataUrl: string
  pageNum: number
  label: string
}

export interface AutoCropProgress {
  stage: 'rendering' | 'slicing' | 'done'
  pageNum: number
  totalPages: number
}

type ProgressCallback = (progress: AutoCropProgress) => void

interface TextLine {
  text: string
  top: number
  bottom: number
}

interface QuestionMarker {
  label: string
  top: number
}

interface RenderedPage {
  pageNum: number
  canvas: HTMLCanvasElement
  markers: QuestionMarker[]
  contentTop: number
  contentBottom: number
}

interface PdfLikeTextItem {
  str: string
  transform: number[]
  height?: number
}

function asTextItem(item: unknown): PdfLikeTextItem | null {
  if (!item || typeof item !== 'object') return null
  const candidate = item as Partial<PdfLikeTextItem>
  if (typeof candidate.str !== 'string' || !Array.isArray(candidate.transform)) return null
  if (candidate.transform.length < 6) return null
  return { str: candidate.str, transform: candidate.transform, height: candidate.height }
}

function normalizeLabel(raw: string): string {
  const match = raw.match(/\d+/)
  return match ? `Q${match[0]}` : raw.trim().slice(0, 12)
}

/**
 * Scans the rendered page for the first and last row containing ink, so
 * graphics that live outside any text run (diagrams, graphs, structures) are
 * still part of the page's content band.
 */
function findInkBounds(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { top: number; bottom: number } | null {
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch {
    return null
  }

  let top = -1
  let bottom = -1

  for (let y = 0; y < canvas.height; y++) {
    const rowStart = y * canvas.width * 4
    for (let x = 0; x < canvas.width; x++) {
      const i = rowStart + x * 4
      if (data[i] < INK_THRESHOLD || data[i + 1] < INK_THRESHOLD || data[i + 2] < INK_THRESHOLD) {
        if (top === -1) top = y
        bottom = y
        break
      }
    }
  }

  return top === -1 ? null : { top, bottom }
}

/** Groups text items of a page into visual lines using viewport coordinates. */
function buildTextLines(items: unknown[], viewport: PageViewport, scale: number): TextLine[] {
  const raw: TextLine[] = []

  for (const rawItem of items) {
    const item = asTextItem(rawItem)
    if (!item) continue

    const text = item.str.replace(/\s+/g, ' ').trim()
    if (!text) continue

    const pdfX = item.transform[4]
    const pdfY = item.transform[5]

    // convertToViewportPoint flips the PDF y-axis into canvas space.
    const [, baselineY] = viewport.convertToViewportPoint(pdfX, pdfY)
    // Text item metrics live in unscaled PDF units, so lift them into canvas pixels.
    const glyphHeight = (Math.abs(item.transform[3]) || Math.abs(item.height ?? 0) || 10) * scale

    raw.push({
      text,
      top: baselineY - glyphHeight,
      bottom: baselineY + glyphHeight * 0.25,
    })
  }

  raw.sort((a, b) => a.top - b.top)

  const lines: TextLine[] = []
  for (const entry of raw) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(entry.top - last.top) <= LINE_TOLERANCE) {
      last.text = `${last.text} ${entry.text}`
      last.top = Math.min(last.top, entry.top)
      last.bottom = Math.max(last.bottom, entry.bottom)
    } else {
      lines.push({ ...entry })
    }
  }

  return lines
}

function findMarkers(lines: TextLine[]): QuestionMarker[] {
  const markers: QuestionMarker[] = []
  for (const line of lines) {
    const match = line.text.match(QUESTION_MARKER_REGEX)
    if (!match) continue
    markers.push({ label: normalizeLabel(match[0]), top: line.top })
  }
  return markers
}

async function renderPage(pdfDoc: PDFDocumentProxy, pageNum: number): Promise<RenderedPage> {
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale: AUTO_CROP_SCALE })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create a 2D canvas context for auto-cropping.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport }).promise

  const textContent = await page.getTextContent()
  const lines = buildTextLines(textContent.items, viewport, AUTO_CROP_SCALE)
  const markers = findMarkers(lines)

  const ink = findInkBounds(canvas, ctx)
  const tops = [...lines.map((l) => l.top), ...(ink ? [ink.top] : [])]
  const bottoms = [...lines.map((l) => l.bottom), ...(ink ? [ink.bottom] : [])]

  const contentTop = tops.length ? Math.max(0, Math.min(...tops) - SLICE_PADDING) : 0
  const contentBottom = bottoms.length
    ? Math.min(canvas.height, Math.max(...bottoms) + SLICE_PADDING)
    : canvas.height

  return { pageNum, canvas, markers, contentTop, contentBottom }
}

function sliceCanvas(source: HTMLCanvasElement, top: number, bottom: number): HTMLCanvasElement | null {
  const y = Math.max(0, Math.floor(top))
  const height = Math.min(source.height, Math.ceil(bottom)) - y
  if (height <= 4) return null

  const slice = document.createElement('canvas')
  slice.width = source.width
  slice.height = height

  const ctx = slice.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, slice.width, slice.height)
  ctx.drawImage(source, 0, y, source.width, height, 0, 0, source.width, height)
  return slice
}

/** Vertically merges slices (cross-page stitching) into one continuous image. */
function mergeSlices(slices: HTMLCanvasElement[]): HTMLCanvasElement | null {
  if (slices.length === 0) return null
  if (slices.length === 1) return slices[0]

  const width = Math.max(...slices.map((s) => s.width))
  const height = slices.reduce((sum, s) => sum + s.height, 0)

  const merged = document.createElement('canvas')
  merged.width = width
  merged.height = height

  const ctx = merged.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  let offsetY = 0
  for (const slice of slices) {
    ctx.drawImage(slice, 0, offsetY)
    offsetY += slice.height
  }

  return merged
}

/**
 * Returns the trailing slices of the pages that follow `pageIndex` and belong
 * to the question which started on that page (i.e. everything above the first
 * question marker of each subsequent page).
 */
function collectContinuation(pages: RenderedPage[], pageIndex: number): HTMLCanvasElement[] {
  const parts: HTMLCanvasElement[] = []

  for (let i = pageIndex + 1; i < pages.length; i++) {
    const next = pages[i]
    const firstMarker = next.markers[0]
    const end = firstMarker ? firstMarker.top - SLICE_PADDING : next.contentBottom
    const slice = sliceCanvas(next.canvas, next.contentTop, end)
    if (slice) parts.push(slice)
    if (firstMarker) break
  }

  return parts
}

export async function processPDFAutoCrop(
  pdfDoc: PDFDocumentProxy,
  onProgress?: ProgressCallback,
): Promise<AutoCropResult[]> {
  if (!pdfDoc || typeof pdfDoc.numPages !== 'number') {
    throw new Error('processPDFAutoCrop requires a loaded pdf.js document.')
  }

  const totalPages = pdfDoc.numPages
  const pages: RenderedPage[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.({ stage: 'rendering', pageNum, totalPages })
    pages.push(await renderPage(pdfDoc, pageNum))
  }

  const results: AutoCropResult[] = []

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    onProgress?.({ stage: 'slicing', pageNum: page.pageNum, totalPages })

    for (let m = 0; m < page.markers.length; m++) {
      const marker = page.markers[m]
      const nextMarker = page.markers[m + 1]
      const top = Math.max(page.contentTop, marker.top - SLICE_PADDING)
      const bottom = nextMarker ? nextMarker.top - SLICE_PADDING : page.contentBottom

      const slice = sliceCanvas(page.canvas, top, bottom)
      if (!slice) continue

      const parts = [slice]
      if (!nextMarker) parts.push(...collectContinuation(pages, i))

      const merged = mergeSlices(parts)
      if (!merged) continue

      results.push({
        dataUrl: merged.toDataURL('image/png'),
        pageNum: page.pageNum,
        label: marker.label,
      })
    }
  }

  onProgress?.({ stage: 'done', pageNum: totalPages, totalPages })
  return results
}
