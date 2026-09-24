'use client'
// User Profile Types
export interface UserProfile {
  name: string
  target: string
  roll?: string
}

// Subject Type definition for CBT
export type Subject = 'physics' | 'chemistry' | 'maths'

// Question Types
export interface Question {
  id: number
  img: string
  page: number
  type: 'single' | 'multi' | 'integer'
  choice: string | string[] | null
  visited: boolean
  markedReview: boolean
  timeSec: number
  eval: 'unattempted' | 'correct' | 'partial' | 'wrong' | 'skip'
  awardedMarks: number
  officialAnswer: string | string[] | number | null
  subject?: Subject
}

// Draft Test Types
export interface DraftTest {
  id: string
  title: string
  dateStr: string
  durationMins: number
  questions: Question[]
}

// Test Record Types
export interface TestRecord {
  id: string
  title: string
  dateStr: string
  timestamp: number
  score: number
  maxScore: number
  accuracy: string
  attemptRate: string
  attempted: number
  totalQuestions: number
  correctCount: number
  partialCount: number
  wrongCount: number
  skippedCount: number
  negScore: number
  totalTimeSec: number
  percentileText: string
  candidateName: string
  questions: Question[]
}

// Storage Keys
const STORAGE_KEYS = {
  USER_PROFILE: 'cbt_user_profile',
  TEST_HISTORY: 'cbt_test_history',
  DRAFT_TESTS: 'cbt_saved_draft_tests'
}

// User Profile Functions
export function getUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.warn('Error reading user profile:', e)
  }
  return null
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
  } catch (e) {
    console.warn('Error saving user profile:', e)
  }
}

export function clearUserProfile(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
  } catch (e) {
    console.warn('Error clearing user profile:', e)
  }
}

// Test History Functions
export function getTestHistory(): TestRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TEST_HISTORY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.warn('Error reading test history:', e)
  }
  return []
}

export function saveTestHistory(history: TestRecord[]): void {
  if (typeof window === 'undefined') return
  
  const sanitizeForStorage = (record: TestRecord, stripImages: boolean = true): TestRecord => {
    if (!record || typeof record !== 'object') return record
    
    const safe = { ...record }
    if (Array.isArray(record.questions)) {
      safe.questions = record.questions.map(q => {
        if (!q || typeof q !== 'object') return q
        const clean = { ...q }
        if (stripImages) {
          clean.img = ''
        } else if (typeof clean.img === 'string' && clean.img.length > 600000) {
          clean.img = ''
        }
        return clean
      })
    }
    return safe
  }

  const tryPersist = (records: TestRecord[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEYS.TEST_HISTORY, JSON.stringify(records))
      return true
    } catch (e) {
      console.warn('Unable to persist CBT history:', e)
      return false
    }
  }

  // First attempt: preserve the current in-memory record and thumbnails
  if (!tryPersist(history)) {
    // Second attempt: remove heavy base64 images from every stored record
    const withoutImages = history.map(rec => sanitizeForStorage(rec, true))
    if (!tryPersist(withoutImages)) {
      // Third attempt: retain only the newest records until they fit
      const compact: TestRecord[] = []
      for (const rec of withoutImages) {
        const candidate = [...compact, rec]
        if (tryPersist(candidate)) {
          compact.push(rec)
        } else {
          break
        }
      }

      // If even one record is too large, persist only its scalar metadata
      if (!tryPersist(compact) && history[0]) {
        const newest = sanitizeForStorage(history[0], true)
        const scalarOnly = { ...newest, questions: [] }
        tryPersist([scalarOnly])
      }
    }
  }
}

export function clearTestHistory(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.TEST_HISTORY)
  } catch (e) {
    console.warn('Error clearing test history:', e)
  }
}

// Draft Tests Functions
export function getDraftTests(): DraftTest[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT_TESTS)
    if (saved) {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.warn('Error reading draft tests:', e)
  }
  return []
}

export function saveDraftTests(drafts: DraftTest[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT_TESTS, JSON.stringify(drafts))
  } catch (e) {
    console.warn('Error saving draft tests:', e)
  }
}

export function clearDraftTests(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT_TESTS)
  } catch (e) {
    console.warn('Error clearing draft tests:', e)
  }
}

// Utility Functions
export function getInitials(name: string): string {
  if (!name) return 'CB'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ', ' + now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}`
}
