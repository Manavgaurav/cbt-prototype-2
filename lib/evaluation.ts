'use client'
import { Question } from './storage'

/**
 * Universal option normalizer:
 * Converts "A", "ABC", "A, B, C", "[A, B]", ["A", "B"], etc.
 * into a clean sorted array: ["A", "B", "C"]
 */
export function normalizeOptions(value: any): string[] {
  if (value === null || value === undefined) return []

  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .flat(Infinity)
          .flatMap(v => normalizeOptions(v))
      )
    ].sort()
  }

  let text = String(value)
    .replace(/[\[\]{}"']/g, '')
    .trim()
    .toUpperCase()

  if (!text) return []

  if (/^[A-D]{2,}$/.test(text)) {
    return [...new Set(text.split(''))].sort()
  }

  const tokens = text
    .split(/[\s,;|]+/)
    .map(v => v.trim())
    .filter(Boolean)

  const finalTokens: string[] = []
  for (const token of tokens) {
    if (/^[A-D]{2,}$/.test(token)) {
      finalTokens.push(...token.split(''))
    } else {
      finalTokens.push(token)
    }
  }

  return [...new Set(finalTokens)].sort()
}

export function hasAttempted(choice: any): boolean {
  if (choice === null || choice === undefined) return false
  if (Array.isArray(choice)) {
    return choice.some(v => v !== null && v !== undefined && String(v).trim() !== '')
  }
  return String(choice).trim() !== ''
}

export function extractKeyMapFromText(rawText: string): Record<number, string | string[] | number> {
  const keyMap: Record<number, string | string[] | number> = {}
  
  // 1. Clean invisible characters and trim
  let source = String(rawText ?? '').replace(/\uFEFF/g, '').trim()
  if (!source) return keyMap

  // 2. Strip markdown code fences if AI outputs ```json ... ```
  source = source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  const assign = (qNum: string | number, value: any) => {
    const n = Number.parseInt(String(qNum).replace(/[^\d]/g, ''), 10)
    if (!Number.isInteger(n) || n < 1) return

    const strVal = String(value ?? '').replace(/[\[\]"']/g, '').trim()
    if (!isNaN(Number(strVal)) && strVal !== '') {
      keyMap[n] = strVal
      return
    }

    const opts = normalizeOptions(value)
    if (opts.length > 1) {
      keyMap[n] = opts
    } else if (opts.length === 1) {
      keyMap[n] = opts[0]
    } else {
      keyMap[n] = strVal
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

        if (value && typeof value === 'object') {
          walk(value, fallbackIndex)
          return
        }

        if (numericKey) assign(numericKey, value)
      })
    }
  }

  try {
    walk(JSON.parse(source))
  } catch (_) {}

  const pairRe = /(?:^|[,{;\n\r])\s*["']?(?:q(?:uestion)?\s*)?(\d+)["']?\s*[:=\-.)]\s*(\[[^\]]*\]|["'][^"']*["']|[A-Za-z0-9.+\-]+(?:\s*(?:,|\/|\s)\s*[A-Za-z0-9.+\-]+)*)/gi
  let match
  while ((match = pairRe.exec(source)) !== null) {
    assign(match[1], match[2])
  }

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

  if (!hasAttempted(q.choice)) {
    q.eval = 'skip'
    q.awardedMarks = 0
    return
  }

  const normalizedOfficial = normalizeOptions(official)
  const isMultiCorrect =
    q.type === 'multi' ||
    Array.isArray(official) ||
    normalizedOfficial.length > 1 ||
    (typeof official === 'string' && /^[A-D]{2,}$/i.test(official.trim()))

  // 1. Numerical / Integer
  if (
    q.type === 'integer' ||
    q.type === 'numerical' ||
    (!isMultiCorrect && !isNaN(Number(String(official).trim())) && !Array.isArray(official))
  ) {
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

  // 2. Multiple Correct
  if (isMultiCorrect) {
    q.type = 'multi'

    const userChoices = normalizeOptions(q.choice)
    const offChoices = normalizedOfficial

    if (userChoices.length === 0) {
      q.eval = 'skip'
      q.awardedMarks = 0
      return
    }

    const correctSelected = userChoices.filter(choice => offChoices.includes(choice))
    const wrongSelected = userChoices.filter(choice => !offChoices.includes(choice))

    if (wrongSelected.length > 0) {
      q.eval = 'wrong'
      q.awardedMarks = -2
      return
    }

    if (userChoices.length === offChoices.length && correctSelected.length === offChoices.length) {
      q.eval = 'correct'
      q.awardedMarks = 4
      return
    }

    if (correctSelected.length > 0) {
      q.eval = 'partial'
      q.awardedMarks = correctSelected.length
      return
    }

    q.eval = 'wrong'
    q.awardedMarks = -2
    return
  }

  // 3. Single Choice
  const userChoice = normalizeOptions(q.choice)[0] ?? ''
  const offChoice = normalizedOfficial[0] ?? ''

  if (userChoice && userChoice === offChoice) {
    q.eval = 'correct'
    q.awardedMarks = 4
  } else {
    q.eval = 'wrong'
    q.awardedMarks = -1
  }
}

export function calculateTestResults(
  questions: Question[],
  keyMap?: Record<string | number, any>
) {
  let score = 0
  let correct = 0
  let partial = 0
  let wrong = 0
  let skipped = 0
  let totalTimeSec = 0
  let attempted = 0
  let negScore = 0

  const normalizedQuestions = questions.map((q) => {
    const safeQ = q && typeof q === 'object' ? q : ({} as Question)

    const activeKey =
      (keyMap && safeQ.id !== undefined && keyMap[safeQ.id] !== undefined)
        ? keyMap[safeQ.id]
        : safeQ.officialAnswer

    if (activeKey !== undefined && activeKey !== null) {
      evaluateQuestionWithKey(safeQ, activeKey)
    }

    const marksRaw = Number(safeQ.awardedMarks)
    const marks = Number.isFinite(marksRaw) ? marksRaw : 0
    const timeRaw = Number(safeQ.timeSec)
    const timeSec = Number.isFinite(timeRaw) && timeRaw >= 0 ? timeRaw : 0
    const evalState = ['correct', 'partial', 'wrong', 'skip'].includes(safeQ.eval ?? '')
      ? safeQ.eval!
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
