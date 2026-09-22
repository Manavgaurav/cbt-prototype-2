'use client'

import { useState, useRef } from 'react'
import { extractKeyMapFromText, evaluateQuestionWithKey } from '@/lib/evaluation'
import { Question } from '@/lib/storage'
import { toast } from 'sonner'

interface AnswerKeyImportProps {
  questions: Question[]
  onEvaluationComplete: () => void
  onClose: () => void
}

export function AnswerKeyImport({ questions, onEvaluationComplete, onClose }: AnswerKeyImportProps) {
  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState('Drag & drop "answer_key.json" here or click to browse')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const geminiPrompt = `Please read this answer key sheet and output the COMPLETE answer key for ALL questions from Question 1 to the very last question without truncating or stopping early.
CRITICAL FORMAT RULES:
- Output a single continuous JSON object with question numbers as keys: "1", "2", "3", ...
- Single Choice: "1": "A"
- Multiple Correct: "2": ["A", "C"] or "A, C"
- Numerical / Integer: "3": 4 or "12.5"
- DO NOT group into nested sections. Provide a flat list containing every single question.
Example format:
{
  "1": "A",
  "2": ["A", "C"],
  "3": 4,
  "4": "B",
  "5": "D"
}
Output ONLY valid JSON without extra chat text.`

  const copyGeminiPrompt = () => {
    navigator.clipboard.writeText(geminiPrompt).then(() => {
      toast.success('Universal Gemini prompt copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to auto-copy, please copy text manually.')
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleFile = (file: File) => {
    setFileName(`Selected: ${file.name}`)
    toast.success(`Reading file ${file.name}...`)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setInputText(result)
      toast.success('Answer key loaded from file! Click Apply.')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const applyAnswerKey = () => {
    const rawText = inputText.trim()
    
    if (!rawText) {
      toast.error('Please upload a file or paste answer key text!')
      return
    }

    const keyMap = extractKeyMapFromText(rawText)
    const questionNumbers = Object.keys(keyMap)
      .map(Number)
      .filter(Number.isInteger)
      .sort((a, b) => a - b)

    if (questionNumbers.length === 0) {
      toast.error('Could not parse answers. Format: {"1":"A","2":["A","C"],"3":4}')
      return
    }

    let evaluatedCount = 0
    let missingCount = 0

    questions.forEach((q, index) => {
      const qNum = index + 1
      if (Object.prototype.hasOwnProperty.call(keyMap, qNum)) {
        evaluateQuestionWithKey(q, keyMap[qNum])
        evaluatedCount++
      } else {
        q.officialAnswer = undefined
        q.eval = 'skip'
        q.awardedMarks = 0
        missingCount++
      }
    })

    const suffix = missingCount
      ? ` ${missingCount} exam questions had no imported key.`
      : ''
    toast.success(`Success! Found ${questionNumbers.length} answers, evaluated ${evaluatedCount} exam questions.${suffix}`)
    
    onEvaluationComplete()
    onClose()
  }

  return (
    <div className="answer-key-import">
      <div className="gemini-prompt-section">
        <div className="prompt-header">
          <span className="prompt-title">UNIVERSAL PROMPT FOR GEMINI (ONE CLICK COPY)</span>
          <button className="copy-prompt-btn" onClick={copyGeminiPrompt}>
            📋 Copy Prompt
          </button>
        </div>
        <div className="prompt-text">
          {geminiPrompt}
        </div>
      </div>

      <div className="file-upload-section">
        <label>Upload Gemini Answer Key File (.json / .txt)</label>
        <div 
          className="file-drop-zone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <span className="file-icon">📂</span>
          <span className="file-name">{fileName}</span>
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".json,.txt" 
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="divider">
        <hr />
        <span>OR PASTE DIRECTLY</span>
        <hr />
      </div>

      <div className="paste-section">
        <label>Paste Answer Key Text or JSON</label>
        <textarea
          className="answer-key-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder='Example:
{"1": "A", "2": ["A", "C"], "3": 15}
or: 1: A, 2: A C, 3: 15'
        />
      </div>

      <div className="modal-actions">
        <button className="secondary-button" onClick={onClose}>Cancel</button>
        <button className="primary-button" onClick={applyAnswerKey}>
          Apply Key & Calculate Marks
        </button>
      </div>
    </div>
  )
}