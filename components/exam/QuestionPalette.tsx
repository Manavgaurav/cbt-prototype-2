'use client'

import { Question } from '@/lib/storage'

interface QuestionPaletteProps {
  questions: Question[]
  currentIndex: number
  onQuestionSelect: (index: number) => void
  answeredCount: number
}

export function QuestionPalette({ questions, currentIndex, onQuestionSelect, answeredCount }: QuestionPaletteProps) {
  const getButtonClass = (q: Question, index: number): string => {
    let baseClass = 'matrix-btn'
    
    if (index === currentIndex) {
      baseClass += ' current'
    }
    
    const isAnswered = q.type === 'multi' 
      ? (Array.isArray(q.choice) && q.choice.length > 0)
      : (q.choice !== null && String(q.choice).trim() !== '')
    
    if (isAnswered) {
      baseClass += ' answered'
    } else if (q.markedReview) {
      baseClass += ' marked-review'
    } else if (q.visited) {
      baseClass += ' visited'
    }
    
    return baseClass
  }

  const completionPercentage = Math.round((answeredCount / questions.length) * 100)

  return (
    <div className="palette-wrap">
      <div className="palette-header-row">
        <div className="hud-title">QUESTION PALETTE</div>
        <span className="palette-summary mono">{answeredCount}/{questions.length} Ans</span>
      </div>
      
      <div className="progress-label">
        <span>EXAM PROGRESS</span>
        <span className="mono">{completionPercentage}%</span>
      </div>
      <div className="progress-meter">
        <div className="progress-fill" style={{ width: `${completionPercentage}%` }} />
      </div>
      
      <div className="grid-matrix">
        {questions.map((q, index) => (
          <button
            key={index}
            className={getButtonClass(q, index)}
            onClick={() => onQuestionSelect(index)}
            title={`Question ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  )
}