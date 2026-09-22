'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Initialize PDF.js worker with matching version
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  console.log('PDF.js version:', pdfjsLib.version)
  console.log('Worker source:', pdfjsLib.GlobalWorkerOptions.workerSrc)
}

export interface PDFPageData {
  pageNum: number
  canvas: HTMLCanvasElement
  cropCanvas: HTMLCanvasElement
  viewport: any
}

export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
  pageNum: number
}

export interface UsePDFReturn {
  pdfDoc: any
  loading: boolean
  error: string | null
  totalPages: number
  zoom: number
  pagesData: PDFPageData[]
  loadPDF: (file: File) => Promise<void>
  setZoom: (zoom: number) => void
  resetZoom: () => void
  clearPDF: () => void
}

export function usePDF(): UsePDFReturn {
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoomState] = useState(1.3)
  const [pagesData, setPagesData] = useState<PDFPageData[]>([])

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const typedArray = new Uint8Array(arrayBuffer)
      
      console.log('Loading PDF with typedArray size:', typedArray.length)
      
      const loadingTask = pdfjsLib.getDocument({ data: typedArray })
      const doc = await loadingTask.promise
      
      console.log('PDF loaded successfully, pages:', doc.numPages)
      
      setPdfDoc(doc)
      setTotalPages(doc.numPages)
      setPagesData([])
      
      // Render all pages
      const pages: PDFPageData[] = []
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum)
        const viewport = page.getViewport({ scale: zoom })
        
        console.log(`Rendering page ${pageNum} with viewport:`, viewport.width, 'x', viewport.height)
        
        // Create canvas elements
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = viewport.width
        cropCanvas.height = viewport.height
        
        // Render page
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise
          console.log(`Page ${pageNum} rendered successfully`)
        }
        
        pages.push({
          pageNum,
          canvas,
          cropCanvas,
          viewport
        })
      }
      
      setPagesData(pages)
      console.log('All pages rendered, total:', pages.length)
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError('Failed to load PDF file: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [zoom])

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(0.8, Math.min(2.5, newZoom))
    setZoomState(clampedZoom)
  }, [])

  const resetZoom = useCallback(() => {
    setZoomState(1.3)
  }, [])

  const clearPDF = useCallback(() => {
    setPdfDoc(null)
    setTotalPages(0)
    setPagesData([])
    setError(null)
  }, [])

  // Re-render pages when zoom changes
  useEffect(() => {
    if (pdfDoc && pagesData.length > 0) {
      const reRender = async () => {
        const newPages: PDFPageData[] = []
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum)
          const viewport = page.getViewport({ scale: zoom })
          
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          const cropCanvas = document.createElement('canvas')
          cropCanvas.width = viewport.width
          cropCanvas.height = viewport.height
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport: viewport
            }).promise
          }
          
          newPages.push({
            pageNum,
            canvas,
            cropCanvas,
            viewport
          })
        }
        setPagesData(newPages)
      }
      
      reRender()
    }
  }, [zoom, pdfDoc])

  return {
    pdfDoc,
    loading,
    error,
    totalPages,
    zoom,
    pagesData,
    loadPDF,
    setZoom,
    resetZoom,
    clearPDF
  }
}

export function useCropSelection(
  cropCanvas: HTMLCanvasElement | null,
  pdfCanvas: HTMLCanvasElement | null,
  pageNum: number,
  onCropComplete: (dataUrl: string, pageNum: number) => void
) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragCurrent, setDragCurrent] = useState({ width: 0, height: 0 })

  const getCoords = useCallback((e: MouseEvent) => {
    if (!cropCanvas) return { x: 0, y: 0 }
    const rect = cropCanvas.getBoundingClientRect()
    const scaleX = cropCanvas.width / rect.width
    const scaleY = cropCanvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }, [cropCanvas])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const pos = getCoords(e)
    setIsDragging(true)
    setDragStart(pos)
    setDragCurrent({ width: 0, height: 0 })
  }, [getCoords])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !cropCanvas) return
    
    const pos = getCoords(e)
    const width = pos.x - dragStart.x
    const height = pos.y - dragStart.y
    
    setDragCurrent({ width, height })
    
    // Draw selection rectangle
    const ctx = cropCanvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
      ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height)
      
      const rx = width < 0 ? dragStart.x + width : dragStart.x
      const ry = height < 0 ? dragStart.y + height : dragStart.y
      const rw = Math.abs(width)
      const rh = Math.abs(height)
      
      ctx.clearRect(rx, ry, rw, rh)
      
      ctx.strokeStyle = '#56e4ff'
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rx, ry, rw, rh)
    }
  }, [isDragging, cropCanvas, dragStart, getCoords])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    
    const rw = Math.abs(dragCurrent.width)
    const rh = Math.abs(dragCurrent.height)
    
    // Clear crop canvas
    if (cropCanvas) {
      const ctx = cropCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height)
      }
    }
    
    // Only crop if selection is large enough
    if (rw > 32 && rh > 32 && pdfCanvas) {
      const rx = dragCurrent.width < 0 ? dragStart.x + dragCurrent.width : dragStart.x
      const ry = dragCurrent.height < 0 ? dragStart.y + dragCurrent.height : dragStart.y
      
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = rw
      tempCanvas.height = rh
      const tCtx = tempCanvas.getContext('2d')
      
      if (tCtx) {
        tCtx.drawImage(pdfCanvas, rx, ry, rw, rh, 0, 0, rw, rh)
        const dataUrl = tempCanvas.toDataURL('image/png')
        onCropComplete(dataUrl, pageNum)
      }
    }
  }, [isDragging, dragCurrent, dragStart, cropCanvas, pdfCanvas, pageNum, onCropComplete])

  useEffect(() => {
    if (!cropCanvas) return

    cropCanvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      cropCanvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [cropCanvas, handleMouseDown, handleMouseMove, handleMouseUp])

  return { isDragging }
}

export function extractDataURLFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const ctx = tempCanvas.getContext('2d')
  
  if (ctx) {
    ctx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height)
    return tempCanvas.toDataURL('image/png')
  }
  
  return ''
}