'use client'
import { useEffect, useState, useRef } from 'react'
import { Clock3 } from 'lucide-react'

interface ExamTimerProps {
  initialMinutes: number
  onTimeUp: () => void
  isActive?: boolean
  className?: string
}

export function ExamTimer({ initialMinutes, onTimeUp, isActive = true, className = '' }: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Jab bhi initialMinutes change ho, timer ki value reset ho jaye
  useEffect(() => {
    setTimeLeft(initialMinutes * 60)
  }, [initialMinutes])

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Only start interval if active
    if (!isActive) return

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, onTimeUp])

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
