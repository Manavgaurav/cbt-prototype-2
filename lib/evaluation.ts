'use client'
import { Question } from './storage'

// Universal Answer Key Parser
export function extractKeyMapFromText(rawText: string): Record<number, string | string[] | number> {
  const keyMap: Record<number, string | string[] | number> = {}
  const source = String(rawText ?? '').replace(/\uFEFF/g, '').trim()
  if (!source) return keyMap

  const normalizeAnswer = (value: any): string | string[] => {
    if (Array.isArray(value)) {
      return value
        .flat(Infinity)
        .map(v => String(v ?? '').trim().replace(/^["']|["']$/g, '').toUpperCase())
        .filter(Boolean)
    }
    if (value === null || value === undefined) return ''
    return String(value).trim().replace(/^["']|["']$/g, '')
  }

  const assign = (qNum: string | number, value: any) => {
    const n = Number.parseInt(String(qNum).replace(/[^\d]/g, ''), 10)
    if (!Number.isInteger(n) || n < 1) return

    let answer = normalizeAnswer(value)

    // Multiple-correct answers: A,C / A C / [A,C].
    if (Array.isArray(answer)) {
      answer = answer
        .flatMap(v => String(v).split(/[\s,;|]+/))
        .map(v => v.trim().toUpperCase())
        .filter(Boolean)
      if (answer.length) keyMap[n] = [...new Set(answer)]
      return
    }

    const cleaned = String(answer).replace(/^\[\vert{}\]$/g, '').trim().toUpperCase()

    // Support all common multiple-correct forms:
    // AD, ABC, A,D, A D, [A,D], ["A","D"].
    if (/^[A-D]{2,}$/.test(cleaned)) {
      keyMap[n] = [...new Set(cleaned.split(''))]
      return
    }

    const parts = cleaned
      .split(/[\s,;|]+/)
      .map(v => v.trim().toUpperCase())
      .filter(Boolean)

    if (parts.length > 1 && parts.every(v => /^[A-D]$/.test(v))) {
      keyMap[n] = [...new Set(parts)]
    } else {
      keyMap[n] = cleaned
    }
  }

  const walk = (node: any, fallbackIndex: number = 0) => {
    if (node === null || node === undefined) return

    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const qNum = item.q ?? item.question ?? item.questionNo ?? item.questionNumber ??
                       item.qno ?? item.number ?? item.num ?? item.id
          const ans = item.a ?? item.ans ?? item.answer ?? item.correctAnswer ??
                      item.correct ?? item.choice ?? item.choices ?? item.val ?? item.value
          if (qNum !== undefined && ans !== undefined) {
            assign(qNum, ans)
          } else {
            walk(item, index + 1)
          }
        } else {
          assign(index + 1, item)
        }
      })
      return
    }

    if (typeof node === 'object') {
      Object.entries(node).forEach(([key, value]) => {
        const numericKey = key.match(/\d+/)?.[0]

        if (numericKey && (typeof value !== 'object' || Array.isArray(value))) {
          assign(numericKey, value)
          return
        }

        // Section-wise/nested formats such as Physics: {"1":"A","2":"B"}.
        if (value && typeof value === 'object') {
          walk(value, fallbackIndex)
          return
        }

        if (numericKey) assign(numericKey, value)
      })
    }
  }

  // 1) Parse the complete input as JSON first. This handles 10/50/90+
  // question objects without relying on a regex that can stop early.
  try {
    walk(JSON.parse(source))
  } catch (_) {
    // Continue with the text fallbacks below.
  }

  // 2) Extract quoted/unquoted "question number : answer" pairs globally.
  // This works even when the answer key is pasted as one long line.
  const pairRe = /(?:^|[,{;\n\r])\s*["']?(?:q(?:uestion)?\s*)?(\d+)["']?\s*[:=\-.)]\s*(\[[^\]]*\]|["'][^"']*["']|[A-Za-z0-9.+\-]+(?:\s*(?:,|\/|\s)\s*[A-Za-z0-9.+\-]+)*)/gi
  let match
  while ((match = pairRe.exec(source)) !== null) {
    assign(match[1], match[2])
  }

  // 3) Line-oriented fallback for formats like:
  // Q1 A
  // 2. B
  // 3 -> 4
  const lines = source.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*(?:q(?:uestion)?\s*)?(\d+)\s*(?:[:.)=\-]|->|\s)\s*(.+?)\s*$/i)
    if (!m) continue
    const value = m[2].replace(/[;,]\s*$/, '').trim()
    if (value) assign(m[1], value)
  }

  return keyMap
}

export function evaluateQuestionWithKey(q: Question, official: string | string[] | number): void {
  q.officialAnswer = official

  // Robustly detect multi-correct answers even when q.type is still "single".
  const isMultiCorrect =
    q.type === 'multi' ||
    Array.isArray(official) ||
    (typeof official === 'string' && /^[A-D]{2,}$/i.test(official.trim()))

  const hasAttempted = isMultiCorrect
    ? (Array.isArray(q.choice)
        ? q.choice.length > 0
        : (q.choice !== null && String(q.choice).trim() !== ''))
    : (q.choice !== null && String(q.choice).trim() !== '')

  if (!hasAttempted) {
    q.eval = 'skip'
    q.awardedMarks = 0
    return
  }

  // 1. NUMERICAL TYPE EVALUATION
  if (q.type === 'integer' || (!isMultiCorrect && !isNaN(Number(official)) && !Array.isArray(official))) {
    q.type = 'integer'
    const userNum = parseFloat(String(q.choice))
    const offNum = parseFloat(String(official))
    if (!isNaN(userNum) && !isNaN(offNum) && Math.abs(userNum - offNum) < 0.001) {
      q.eval = 'correct'
      q.awardedMarks = 4
    } else {
      q.eval = 'wrong'
      q.awardedMarks = 0
    }
    return
  }

  // 2. MULTIPLE CORRECT EVALUATION (JEE ADVANCED PATTERN)
  if (isMultiCorrect) {
    q.type = 'multi'

    const normalizeChoices = (value: any): string[] => {
      if (Array.isArray(value)) {
        return value
          .flat(Infinity)
          .map(v => String(v ?? '').trim().toUpperCase())
          .filter(Boolean)
          .flatMap(v => /^[A-D]{2,}$/.test(v) ? v.split('') : v.split(/[\s,;|]+/))
          .filter(Boolean)
      }

      const text = String(value ?? '').trim().toUpperCase()
      if (!text) return []
      if (/^[A-D]{2,}$/.test(text)) return text.split('')
      return text.split(/[\s,;|]+/).filter(Boolean)
    }

    const userChoices = [...new Set(normalizeChoices(q.choice))].sort()
    const offChoices = [...new Set(normalizeChoices(official))].sort()

    const correctSelected = userChoices.filter(c => offChoices.includes(c))
    const wrongSelected = userChoices.filter(c => !offChoices.includes(c))

    if (wrongSelected.length > 0) {
      // Kisi bhi galat option ko choose karne par negative marking
      q.eval = 'wrong'
      q.awardedMarks = -2
    } else if (
      correctSelected.length === offChoices.length &&
      userChoices.length === offChoices.length
    ) {
      // Saare correct options choose karne par full marks
      q.eval = 'correct'
      q.awardedMarks = 4
    } else if (correctSelected.length > 0) {
      // JEE Advanced Partial Marking Logic:
      q.eval = 'partial'
      if (offChoices.length === 4 && correctSelected.length === 3) {
        q.awardedMarks = 3
      } else if (offChoices.length >= 3 && correctSelected.length === 2) {
        q.awardedMarks = 2
      } else if (offChoices.length >= 2 && correctSelected.length === 1) {
        q.awardedMarks = 1
      } else {
        q.awardedMarks = correctSelected.length
      }
    } else {
      q.eval = 'skip'
      q.awardedMarks = 0
    }
    return
  }

  // 3. SINGLE CHOICE EVALUATION
  if (String(q.choice).toUpperCase() === String(official).toUpperCase()) {
    q.eval = 'correct'
    q.awardedMarks = 4
  } else {
    q.eval = 'wrong'
    q.awardedMarks = -1
  }
}

export function calculateTestResults(questions: Question[]) {
  let score = 0
  let correct = 0
  let partial = 0
  let wrong = 0
  let skipped = 0
  let totalTimeSec = 0
  let attempted = 0
  let negScore = 0

  const normalizedQuestions = questions.map((q) => {
    const safeQ = q && typeof q === 'object' ? q : {}
    const marksRaw = Number(safeQ.awardedMarks)
    const marks = Number.isFinite(marksRaw) ? marksRaw : 0
    const timeRaw = Number(safeQ.timeSec)
    const timeSec = Number.isFinite(timeRaw) && timeRaw >= 0 ? timeRaw : 0
    const evalState = ['correct', 'partial', 'wrong', 'skip'].includes(safeQ.eval)
      ? safeQ.eval
      : 'skip'

    totalTimeSec += timeSec
    score += marks

    if (evalState === 'correct') {
      correct++
      attempted++
    } else if (evalState === 'partial') {
      partial++
      attempted++
    } else if (evalState === 'wrong') {
      wrong++
      attempted++
      if (marks < 0) negScore += Math.abs(marks)
    } else {
      skipped++
    }

    return {
      ...safeQ,
      awardedMarks: marks,
      timeSec,
      eval: evalState,
      choice: Array.isArray(safeQ.choice)
        ? safeQ.choice.map(v => String(v))
        : (safeQ.choice === null || safeQ.choice === undefined ? null : String(safeQ.choice))
    }
  })

  // Keep all arithmetic finite even if imported/mutated data contains NaN/Infinity.
  score = Number.isFinite(score) ? score : 0
  totalTimeSec = Number.isFinite(totalTimeSec) ? totalTimeSec : 0
  negScore = Number.isFinite(negScore) ? negScore : 0

  const totalQuestions = normalizedQuestions.length
  const maxScore = Math.max(totalQuestions * 4, 1)
  const accuracyNum = attempted > 0
    ? ((correct + partial * 0.5) / attempted) * 100
    : 0
  const attemptRateNum = totalQuestions > 0
    ? (attempted / totalQuestions) * 100
    : 0
  const accuracy = Number.isFinite(accuracyNum) ? accuracyNum.toFixed(1) : '0.0'
  const attemptRate = Number.isFinite(attemptRateNum) ? attemptRateNum.toFixed(1) : '0.0'

  const pctRaw = (score / maxScore) * 100
  const pct = Number.isFinite(pctRaw) ? pctRaw : 0

  let percentileText = '--'
  if (pct >= 85) percentileText = '99.4 - 99.9 %ile'
  else if (pct >= 70) percentileText = '97.5 - 98.9 %ile'
  else if (pct >= 55) percentileText = '94.0 - 96.8 %ile'
  else if (pct >= 40) percentileText = '88.0 - 92.5 %ile'
  else if (pct >= 25) percentileText = '75.0 - 85.0 %ile'
  else percentileText = `${Math.max(15, Math.round(pct * 2.2))}%ile`

  return {
    normalizedQuestions,
    score,
    maxScore,
    accuracy,
    attemptRate,
    attempted,
    totalQuestions,
    correct,
    partial,
    wrong,
    skipped,
    negScore,
    totalTimeSec,
    percentileText
  }
}
