'use client'

import { useCallback, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Loader2, ScissorsSquare, UploadCloud } from 'lucide-react'

import { processPDFAutoCrop, type AutoCropResult } from '@/lib/auto-crop'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

const violet = '#8b5cf6'
const violetSoft = 'rgba(139,92,246,.25)'

export default function AutoTestPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [crops, setCrops] = useState<AutoCropResult[]>([])

  const handleFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    setCrops([])
    setFileName(file.name)
    setStatus('Loading PDF…')

    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const pdfDoc = await pdfjsLib.getDocument({ data }).promise

      const results = await processPDFAutoCrop(pdfDoc, (progress) => {
        setStatus(
          progress.stage === 'done'
            ? 'Finalising slices…'
            : `${progress.stage === 'rendering' ? 'Rendering' : 'Slicing'} page ${progress.pageNum} / ${progress.totalPages}`,
        )
      })

      setCrops(results)
      setStatus(`${results.length} question${results.length === 1 ? '' : 's'} detected`)
    } catch (err) {
      setError((err as Error).message)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <main style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(139,92,246,.12)',
              border: `1px solid ${violetSoft}`,
              boxShadow: '0 0 18px rgba(139,92,246,.25)',
            }}
          >
            <ScissorsSquare width={20} height={20} color="#a78bfa" />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-.01em' }}>Auto Crop Lab</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a1a1aa' }}>
              Isolated sandbox — detects question boundaries and slices full-width strips from the rendered PDF.
            </p>
          </div>
        </header>

        <section
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${violetSoft}`,
            borderRadius: 14,
            padding: 28,
            textAlign: 'center',
            background: 'rgba(9,9,11,.6)',
            cursor: busy ? 'progress' : 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          <UploadCloud width={26} height={26} color="#a78bfa" />
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>
            {fileName || 'Upload a question paper PDF'}
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: '#71717a' }}>
            Rendered at scale 2.0 · images, formulas and diagrams stay intact
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </section>

        {(busy || status) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#a78bfa',
            }}
          >
            {busy && <Loader2 width={14} height={14} className="animate-spin" />}
            {status}
          </div>
        )}

        {error && (
          <div
            style={{
              border: '1px solid rgba(248,113,113,.4)',
              background: 'rgba(69,10,10,.45)',
              color: '#fca5a5',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
          {crops.map((crop, index) => (
            <article
              key={`${crop.label}-${crop.pageNum}-${index}`}
              style={{
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(9,9,11,.6)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}>
                  {crop.label}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1,
                    color: '#a78bfa',
                    background: 'rgba(139,92,246,.1)',
                    border: `1px solid ${violetSoft}`,
                    padding: '2px 7px',
                    borderRadius: 4,
                  }}
                >
                  PAGE {crop.pageNum}
                </span>
              </div>
              <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: `1px solid ${violet}22` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={crop.dataUrl} alt={crop.label} style={{ width: '100%', display: 'block' }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
