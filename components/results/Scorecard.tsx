'use client'

import { TestRecord, Question } from '@/lib/storage'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'

interface ScorecardProps {
  record: TestRecord
  onBack: () => void
  onNewTest: () => void
  onDelete: () => void
}

export function Scorecard({ record, onBack, onNewTest, onDelete }: ScorecardProps) {
  const getEfficiencyBadge = (q: Question, index: number) => {
    const timeSec = Number(q.timeSec) || 0
    const evalState = q.eval

    if (evalState === 'correct') {
      if (timeSec <= 35) {
        return '<span class="badge cyan">⚡ LIGHTNING SOLVE</span>'
      }
      return '<span class="badge emerald">🎯 SOLID SOLVE</span>'
    } else if (evalState === 'partial') {
      return '<span class="badge partial">★ PARTIAL CREDIT</span>'
    } else if (evalState === 'wrong') {
      if (timeSec >= 80) {
        return '<span class="badge rose">⚠️ TIME TRAP</span>'
      }
      return '<span class="badge rose">💨 RAPID GUESS</span>'
    }
    return '<span class="badge gray">SKIPPED</span>'
  }

  const getImpact = (q: Question) => {
    const marks = Number(q.awardedMarks) || 0
    const evalState = q.eval

    if (evalState === 'correct') {
      return `<b class="positive">+${marks}</b>`
    } else if (evalState === 'partial') {
      return `<b class="partial">+${marks}</b>`
    } else if (evalState === 'wrong') {
      return `<b class="negative">${marks >= 0 ? '-' + marks : marks}</b>`
    }
    return '<span class="muted-text">0</span>'
  }

  const getUserAnswer = (q: Question) => {
    if (q.choice !== null && q.choice !== undefined && q.choice !== '') {
      return Array.isArray(q.choice)
        ? q.choice.map(v => String(v)).join(', ')
        : String(q.choice)
    }
    return '—'
  }

  return (
    <div className="scorecard">
      <div className="page-heading">
        <div>
          <button className="secondary-button" onClick={onBack} style={{ marginBottom: '8px' }}>
            <ArrowLeft />
            Back to Test History
          </button>
          <div className="eyebrow">DETAILED REPORT</div>
          <h1>{record.title}</h1>
          <p>Attempted on {record.dateStr} · Candidate: {record.candidateName}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={onDelete}>
            <Trash2 />
            Delete Record
          </button>
          <button className="primary-button" onClick={onNewTest}>
            <Plus />
            New Test Session
          </button>
        </div>
      </div>

      <div className="hero-cluster">
        <div className="hero-stat-card">
          <div className="eyebrow">OVERALL CANDIDATE SCORE</div>
          <div className="score-mega-num">
            {record.score} <small>/ {record.maxScore}</small>
          </div>
          <div className="subject-row">
            ACCURACY: <b>{record.accuracy}%</b> ATTEMPTED: <b>{record.attempted}</b>
          </div>
        </div>
        <div className="hero-stat-card percentile">
          <div className="eyebrow">ESTIMATED PERCENTILE</div>
          <div className="percentile-mega-num">{record.percentileText}</div>
          <small>Normalized against competitive benchmark percentile curves</small>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">📊</span>
            <span className="stat-detail">ATTEMPT RATE</span>
          </div>
          <div className="stat-value mono">{record.attemptRate}%</div>
          <div className="stat-label">Questions Attempted</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">🎯</span>
            <span className="stat-detail">ACCURACY</span>
          </div>
          <div className="stat-value mono cyan">{record.accuracy}%</div>
          <div className="stat-label">Correct Answers</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">📉</span>
            <span className="stat-detail">MARKS LOST (NEGATIVE)</span>
          </div>
          <div className="stat-value mono rose">-{record.negScore}</div>
          <div className="stat-label">Negative Marking</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">⏱️</span>
            <span className="stat-detail">TOTAL TIME SPENT</span>
          </div>
          <div className="stat-value mono">{Math.round(record.totalTimeSec / 60)}m</div>
          <div className="stat-label">Duration</div>
        </div>
      </div>

      <div className="hud-title" style={{ marginBottom: '10px' }}>
        PER-QUESTION TIME TELEMETRY & EFFICIENCY PROFILING
      </div>
      
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ITEM</th>
              <th>PREVIEW</th>
              <th>SUBMITTED ANSWER</th>
              <th>EVALUATION</th>
              <th>SCORE</th>
              <th>TIME</th>
              <th>EFFICIENCY</th>
            </tr>
          </thead>
          <tbody>
            {record.questions.map((q, index) => {
              const timeSec = Number(q.timeSec) || 0
              return (
                <tr key={index}>
                  <td className="mono">Q{index + 1 < 10 ? '0' : ''}{index + 1}</td>
                  <td>
                    {q.img ? (
                      <img 
                        src={q.img} 
                        alt={`Q${index + 1}`}
                        className="question-thumb"
                        onClick={() => {/* Add image inspection modal */}}
                      />
                    ) : (
                      <span className="muted-text">Preview saved</span>
                    )}
                  </td>
                  <td className={`mono ${q.choice !== null ? 'positive' : 'muted-text'}`}>
                    {getUserAnswer(q)}
                  </td>
                  <td className="eval-status">{q.eval.toUpperCase()}</td>
                  <td dangerouslySetInnerHTML={{ __html: getImpact(q) }} />
                  <td className="mono">{timeSec}s ({(timeSec / 60).toFixed(1)}m)</td>
                  <td dangerouslySetInnerHTML={{ __html: getEfficiencyBadge(q, index) }} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}