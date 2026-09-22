'use client'

import { TestRecord } from '@/lib/storage'
import { BarChart3, Trash2, Plus } from 'lucide-react'

interface ResultsHubProps {
  testHistory: TestRecord[]
  onViewScorecard: (recordId: string) => void
  onNewTest: () => void
  onClearHistory: () => void
  onDeleteRecord: (recordId: string) => void
}

export function ResultsHub({ 
  testHistory, 
  onViewScorecard, 
  onNewTest, 
  onClearHistory,
  onDeleteRecord 
}: ResultsHubProps) {
  const totalTests = testHistory.length
  
  const calculateStats = () => {
    if (totalTests === 0) {
      return {
        bestScore: 0,
        bestMax: 0,
        avgAccuracy: '0.0',
        totalSolved: 0
      }
    }

    let bestScore = -Infinity
    let bestMax = 0
    let sumAccuracy = 0
    let totalSolved = 0

    testHistory.forEach(rec => {
      if (!rec) return
      const s = Number(rec.score) || 0
      if (s > bestScore) {
        bestScore = s
        bestMax = Number(rec.maxScore) || 0
      }
      sumAccuracy += parseFloat(rec.accuracy || 0)
      totalSolved += ((Number(rec.correctCount) || 0) + (Number(rec.wrongCount) || 0) + (Number(rec.partialCount) || 0))
    })

    const avgAcc = (sumAccuracy / Math.max(totalTests, 1)).toFixed(1)

    return {
      bestScore: bestScore === -Infinity ? 0 : bestScore,
      bestMax,
      avgAccuracy: avgAcc,
      totalSolved
    }
  }

  const stats = calculateStats()

  return (
    <div className="results-hub">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <BarChart3 />
            ANALYTICS & PERFORMANCE
          </div>
          <h1>Results & Test History Hub</h1>
          <p>Archive of all completed computer-based tests with full per-question review and speed telemetry.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={onClearHistory}>
            <Trash2 />
            Clear All History
          </button>
          <button className="primary-button" onClick={onNewTest}>
            <Plus />
            Take New Test
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box"><BarChart3 /></span>
            <span className="stat-detail">Total Tests Attempted</span>
          </div>
          <div className="stat-value mono">{totalTests}</div>
          <div className="stat-label">Tests Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">🏆</span>
            <span className="stat-detail">Highest Score</span>
          </div>
          <div className="stat-value mono">{stats.bestScore} / {stats.bestMax}</div>
          <div className="stat-label">Best Performance</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">🎯</span>
            <span className="stat-detail">Average Accuracy</span>
          </div>
          <div className="stat-value mono">{stats.avgAccuracy}%</div>
          <div className="stat-label">Consistency Metric</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="icon-box">📊</span>
            <span className="stat-detail">Total Questions Solved</span>
          </div>
          <div className="stat-value mono">{stats.totalSolved}</div>
          <div className="stat-label">Practice Volume</div>
        </div>
      </div>

      <div className="section-heading">
        <h2>Attempted Mock Tests</h2>
        <span className="records-count">{totalTests} {totalTests === 1 ? 'test' : 'tests'} logged</span>
      </div>

      {totalTests === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <b>No test history yet</b>
          <span>Complete and evaluate your first mock test to view detailed performance trends here.</span>
        </div>
      ) : (
        <div className="test-records-list">
          {testHistory.map((rec) => (
            <div key={rec.id} className="test-record-card">
              <div className="record-main">
                <div className="record-header-line">
                  <span className="record-title">{rec.title}</span>
                  <span className="record-badge-date">📅 {rec.dateStr}</span>
                </div>
                <div className="record-stats-line">
                  <span>Accuracy: <b>{rec.accuracy}%</b></span>
                  <span>Attempted: <b>{rec.attempted}/{rec.totalQuestions}</b></span>
                  <span>Correct: <b className="positive">{rec.correctCount}</b></span>
                  {rec.partialCount > 0 && <span>Partial: <b className="partial">{rec.partialCount}</b></span>}
                  <span>Wrong: <b className="negative">{rec.wrongCount}</b></span>
                  <span>Time: <b>{Math.round(rec.totalTimeSec / 60)}m</b></span>
                </div>
              </div>
              <div className="record-score-cluster">
                <div className="record-score-num">{rec.score} <small>/ {rec.maxScore}</small></div>
                <div className="record-percentile-tag">{rec.percentileText}</div>
              </div>
              <div className="record-actions">
                <button className="primary-button" onClick={() => onViewScorecard(rec.id)}>
                  View Detailed Report →
                </button>
                <button className="icon-button subtle" onClick={() => onDeleteRecord(rec.id)}>
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}