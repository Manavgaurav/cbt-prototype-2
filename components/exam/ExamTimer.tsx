'use client'

import { useEffect, useState, useRef } from 'react'
import { Clock3 } from 'lucide-react'

interface ExamTimerProps {
  initialMinutes: number
  onTimeUp: () => void
  isActive?: boolean
  className?: string
}

export function ExamTimer({
  initialMinutes,
  onTimeUp,
  isActive = true,
  className = '',
}: ExamTimerProps) {
  const totalSeconds = Math.max(0, Math.floor(initialMinutes * 60))

  const [timeLeft, setTimeLeft] = useState(totalSeconds)

  const endTimeRef = useRef<number | null>(null)
  const onTimeUpRef = useRef(onTimeUp)
  const timeUpCalledRef = useRef(false)

  // Always keep latest callback
  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  }, [onTimeUp])

  // Reset timer only when exam duration changes
  useEffect(() => {
    if (!isActive) return

    endTimeRef.current = Date.now() + totalSeconds * 1000
    timeUpCalledRef.current = false
    setTimeLeft(totalSeconds)
  }, [totalSeconds, isActive])

  // Timer
  useEffect(() => {
    if (!isActive || endTimeRef.current === null) return

    const updateTimer = () => {
      if (endTimeRef.current === null) return

      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000)
      )

      setTimeLeft(remaining)

      if (remaining <= 0 && !timeUpCalledRef.current) {
        timeUpCalledRef.current = true
        onTimeUpRef.current()
      }
    }

    updateTimer()

    const interval = window.setInterval(updateTimer, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [isActive])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    return `${String(h).padStart(2, '0')}:${String(m).padStart(
      2,
      '0'
    )}:${String(s).padStart(2, '0')}`
  }

  const isLowTime = timeLeft < 300

  return (
    <div
      className={`timer-card ${className} ${
        isLowTime ? 'warning' : ''
      }`}
    >
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
