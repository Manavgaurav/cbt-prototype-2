'use client'

import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'

interface ExamTimerProps {
  initialMinutes: number
  onTimeUp: () => void
  className?: string
}

export function ExamTimer({ initialMinutes, onTimeUp, className = '' }: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setIsRunning(true)
  }, [])

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, onTimeUp])

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }

  const isLowTime = timeLeft < 300 // Less than 5 minutes

  return (
    <div className={`timer-card ${className} ${isLowTime ? 'warning' : ''}`}>
      <div className="timer-header">
        <Clock3 className="timer-icon" />
        <span>TIME REMAINING</span>
      </div>
      <div className={`timer-value ${isLowTime ? 'warning' : ''}`}>
        {formatTime(timeLeft)}
      </div>
    </div>
  )
}