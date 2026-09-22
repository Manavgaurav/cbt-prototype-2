'use client'

import { Question } from '@/lib/storage'

interface AnswerInputsProps {
  question: Question
  onAnswerChange: (answer: string | string[] | null) => void
}

export function AnswerInputs({ question, onAnswerChange }: AnswerInputsProps) {
  const handleSingleChoice = (value: string) => {
    onAnswerChange(value)
  }

  const handleMultiChoice = (value: string) => {
    const current = Array.isArray(question.choice) ? question.choice : []
    if (current.includes(value)) {
      onAnswerChange(current.filter(v => v !== value))
    } else {
      onAnswerChange([...current, value])
    }
  }

  const handleIntegerChange = (value: string) => {
    onAnswerChange(value.trim() || null)
  }

  if (question.type === 'single') {
    return (
      <div className="answer-grid">
        {['A', 'B', 'C', 'D'].map(option => (
          <button
            key={option}
            className={`answer-option ${question.choice === option ? 'chosen' : ''}`}
            onClick={() => handleSingleChoice(option)}
          >
            <span className="option-mark">{question.choice === option ? '✓' : option}</span>
            <span>OPTION {option}</span>
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'multi') {
    const currentChoices = Array.isArray(question.choice) ? question.choice : []
    return (
      <div className="answer-grid">
        {['A', 'B', 'C', 'D'].map(option => (
          <button
            key={option}
            className={`answer-option ${currentChoices.includes(option) ? 'chosen' : ''}`}
            onClick={() => handleMultiChoice(option)}
          >
            <span className="option-mark">{currentChoices.includes(option) ? '☑' : '☐'}</span>
            <span>OPTION {option}</span>
          </button>
        ))}
      </div>
    )
  }

  if (question.type === 'integer') {
    return (
      <div className="integer-input-container">
        <label className="integer-label">Enter Numerical / Decimal Value:</label>
        <input
          type="text"
          className="integer-input"
          value={question.choice !== null ? String(question.choice) : ''}
          onChange={(e) => handleIntegerChange(e.target.value)}
          placeholder="e.g. 4 or 12.5 or -3"
          autoComplete="off"
        />
        <small className="integer-hint">Supports integers and decimal answers</small>
      </div>
    )
  }

  return null
}