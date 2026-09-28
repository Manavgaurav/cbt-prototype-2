'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Activity, Archive, ArrowUpRight, BarChart3, Bell, BookOpen, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, Database, Download,
  FileArchive, FileText, Flame, FolderOpen, Gauge, GraduationCap, Grid2X2,
  HelpCircle, History, LayoutDashboard, ListChecks, Menu, MoreHorizontal, PanelLeft,
  Pencil, Play, Plus, RotateCcw, Search, Settings2, Target, Trash2,
  UploadCloud, UserRound, X, Zap, ZoomIn, ZoomOut, Save as SaveIcon, Star, Flag, Atom,
  Scissors, SlidersHorizontal, Loader2, Link2, CheckCheck
} from 'lucide-react'

// Import our custom utilities and components
import { 
  UserProfile, Question, DraftTest, TestRecord, Subject,
  getUserProfile, saveUserProfile, getTestHistory, saveTestHistory, 
  getDraftTests, saveDraftTests, clearDraftTests, getInitials, formatDate, generateId 
} from '@/lib/storage'
import { usePDF, useCropSelection } from '@/lib/pdf-utils'
import { processPDFAutoCrop } from '@/lib/auto-crop'
import { ExamTimer } from '@/components/exam/ExamTimer'
import { QuestionPalette } from '@/components/exam/QuestionPalette'
import { AnswerInputs } from '@/components/exam/AnswerInputs'
import { AnswerKeyImport } from '@/components/evaluation/AnswerKeyImport'
import { ResultsHub } from '@/components/results/ResultsHub'
import { Scorecard } from '@/components/results/Scorecard'
import { extractKeyMapFromText, evaluateQuestionWithKey, calculateTestResults, hasAttempted } from '@/lib/evaluation'

const nav = [
  { label: 'Dashboard', icon: LayoutDashboard, color: 'violet' }, 
  { label: 'Upload & Extract', icon: UploadCloud, color: 'cyan' },
  { label: 'Question Queue', icon: ListChecks, color: 'mint' }, 
  { label: 'Saved Tests Bank', icon: Archive, color: 'rose' },
  { label: 'Start Exam', icon: Play, color: 'orange' }, 
  { label: 'Results Hub', icon: BarChart3, color: 'purple' },
  { label: 'Profile Settings', icon: Settings2, color: 'gray' },
]

function Pill({ children, color = 'muted' }: { children: React.ReactNode, color?: string }) {
  return <span className={`pill pill-${color}`}>{children}</span>
}

function StatCard({ icon: Icon, label, value, detail, accent }: any) {
  return <motion.div whileHover={{ y: -3 }} className={`glass stat-card accent-${accent}`}>
    <div className="stat-top"><span className="icon-box"><Icon /></span><span className="stat-detail">{detail}</span></div>
    <div className="stat-value mono">{value}</div><div className="stat-label">{label}</div>
  </motion.div>
}

// Utility to merge two question images vertically into one
const mergeTwoQuestions = async (topImgUrl: string, bottomImgUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img1 = new Image()
    const img2 = new Image()
    let loaded = 0

    const onLoad = () => {
      loaded++
      if (loaded === 2) {
        const width = Math.max(img1.naturalWidth, img2.naturalWidth)
        const height = img1.naturalHeight + img2.naturalHeight

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img1, 0, 0)
          ctx.drawImage(img2, 0, img1.naturalHeight)
        }
        resolve(canvas.toDataURL('image/png'))
      }
    }

    img1.onload = onLoad
    img2.onload = onLoad
    img1.src = topImgUrl
    img2.src = bottomImgUrl
  })
}

// Interactive Split Modal for merged questions (e.g. Q5 + Q6)
function SplitModal({ question, onClose, onSplit }: { question: Question, onClose: () => void, onSplit: (img1: string, img2: string) => void }) {
  const [splitPercent, setSplitPercent] = useState(50)
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleApplySplit = () => {
    if (!imgRef.current) return
    setIsProcessing(true)

    const img = imgRef.current
    const naturalWidth = img.naturalWidth || 800
    const naturalHeight = img.naturalHeight || 600

    const splitY = Math.round((naturalHeight * splitPercent) / 100)

    // Part 1: Top Question
    const canvas1 = document.createElement('canvas')
    canvas1.width = naturalWidth
    canvas1.height = splitY
    const ctx1 = canvas1.getContext('2d')
    if (ctx1) {
      ctx1.drawImage(img, 0, 0, naturalWidth, splitY, 0, 0, naturalWidth, splitY)
    }

    // Part 2: Bottom Question
    const canvas2 = document.createElement('canvas')
    canvas2.width = naturalWidth
    canvas2.height = naturalHeight - splitY
    const ctx2 = canvas2.getContext('2d')
    if (ctx2) {
      ctx2.drawImage(img, 0, splitY, naturalWidth, naturalHeight - splitY, 0, 0, naturalWidth, naturalHeight - splitY)
    }

    const dataUrl1 = canvas1.toDataURL('image/png')
    const dataUrl2 = canvas2.toDataURL('image/png')

    onSplit(dataUrl1, dataUrl2)
    setIsProcessing(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="modal glass" 
        style={{ maxWidth: '750px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: '#c084fc' }}>QUESTION SEPARATION TOOL</div>
            <h2>Split Merged Question</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X /></button>
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 16px 0' }}>
          Drag the cut line to place it exactly between the two questions. This will instantly split this card into 2 individual question entries in your queue.
        </p>

        {/* Visual Splitter Container */}
        <div style={{ position: 'relative', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', overflow: 'hidden', background: '#0b0f19', textAlign: 'center' }}>
          <img 
            ref={imgRef} 
            src={question.img} 
            alt="Question to split" 
            style={{ width: '100%', display: 'block', maxHeight: '55vh', objectFit: 'contain' }}
          />

          {/* Cut Line Indicator */}
          <div 
            style={{
              position: 'absolute',
              top: `${splitPercent}%`,
              left: 0,
              right: 0,
              height: '3px',
              background: '#06b6d4',
              boxShadow: '0 0 10px #06b6d4',
              pointerEvents: 'none',
              transform: 'translateY(-50%)',
              zIndex: 5
            }}
          >
            <span style={{
              position: 'absolute',
              right: '12px',
              top: '-12px',
              background: '#06b6d4',
              color: '#000',
              fontWeight: 800,
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '999px',
              textTransform: 'uppercase'
            }}>
              Cut Line ({splitPercent}%)
            </span>
          </div>
        </div>

        {/* Slider control */}
        <div style={{ margin: '20px 0 10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
            <span>Top Part (Question A)</span>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>Cut Position: {splitPercent}%</span>
            <span>Bottom Part (Question B)</span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="95" 
            value={splitPercent} 
            onChange={(e) => setSplitPercent(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', cursor: 'pointer' }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button 
            className="primary-button" 
            onClick={handleApplySplit} 
            disabled={isProcessing}
            style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}
          >
            <Scissors size={16} /> Split into 2 Questions
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function Page() {
  // UI State
  const [active, setActive] = useState('Dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [clock, setClock] = useState(new Date())
  const [showProfile, setShowProfile] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'draft' | 'question' | 'test', id: string, onConfirm: () => void } | null>(null)

  // Split Modal State
  const [splittingQuestion, setSplittingQuestion] = useState<{ question: Question, index: number } | null>(null)

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Subject Management State
  const [activeCropSubject, setActiveCropSubject] = useState<Subject>('physics')
  const activeCropSubjectRef = useRef<Subject>(activeCropSubject)

  useEffect(() => {
    activeCropSubjectRef.current = activeCropSubject
  }, [activeCropSubject])
  const [activeExamSubject, setActiveExamSubject] = useState<Subject>('physics')

  // PDF and Question State
  const { pdfDoc, loading, error, totalPages, zoom, pagesData, loadPDF, setZoom, resetZoom, clearPDF } = usePDF()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentFileName, setCurrentFileName] = useState('')
  const [isAutoCropping, setIsAutoCropping] = useState(false)

  // Page Range Filter State for Auto Crop
  const [pageStart, setPageStart] = useState<number>(1)
  const [pageEnd, setPageEnd] = useState<number>(1)

  // Quick Bulk Section Assign State (e.g. Q 1 to 10 -> Physics)
  const [bulkFromQ, setBulkFromQ] = useState<number>(1)
  const [bulkToQ, setBulkToQ] = useState<number>(1)

  useEffect(() => {
    if (totalPages > 0) {
      setPageStart(1)
      setPageEnd(totalPages)
    }
  }, [totalPages])

  useEffect(() => {
    if (questions.length > 0) {
      setBulkToQ(questions.length)
    } else {
      setBulkFromQ(1)
      setBulkToQ(1)
    }
  }, [questions.length])

  // Exam State
  const [examData, setExamData] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [examDuration, setExamDuration] = useState(180)
  const [examActive, setExamActive] = useState(false)
  const [showAnswerKeyImport, setShowAnswerKeyImport] = useState(false)

  // Draft Tests State
  const [draftTests, setDraftTests] = useState<DraftTest[]>([])

  // Test History State
  const [testHistory, setTestHistory] = useState<TestRecord[]>([])
  const [selectedScorecard, setSelectedScorecard] = useState<TestRecord | null>(null)

  // Save Draft Modal State
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDuration, setDraftDuration] = useState(60)

  // Initialize data on mount
  useEffect(() => {
    const profile = getUserProfile()
    if (!profile || !profile.name) {
      setShowOnboarding(true)
    } else {
      setUserProfile(profile)
    }

    const history = getTestHistory()
    setTestHistory(history)

    const drafts = getDraftTests()
    setDraftTests(drafts)
  }, [])

  // Clock update
  useMemo(() => { 
    const id = setInterval(() => setClock(new Date()), 1000); 
    return () => clearInterval(id) 
  }, [])

  const navTo = (label: string) => { 
    setActive(label); 
    setMobileNav(false) 
  }

  const notify = (message: string) => toast.success(message)

  // Profile Management
  const handleSaveProfile = (name: string, target: string, roll?: string) => {
    const profile: UserProfile = {
      name: name || 'Candidate',
      target: target || 'JEE Main & Advanced',
      roll
    }
    setUserProfile(profile)
    saveUserProfile(profile)
    setShowOnboarding(false)
    setModal(null)
    notify(`Welcome aboard, ${profile.name}!`)
  }

  // PDF Handling
  const handlePDFUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      notify('Please upload a valid PDF document.')
      return
    }
    
    setCurrentFileName(file.name.replace(/\.pdf$/i, ''))
    await loadPDF(file)
    notify(`PDF loaded! ${totalPages || 'Multiple'} pages ready.`)
  }

  // Auto Crop Action with Page Range Filtering
  const handleRunAutoCrop = async () => {
    if (!pdfDoc) {
      notify('Please upload a PDF document first!')
      return
    }

    try {
      setIsAutoCropping(true)
      notify(`Auto-detecting questions from Page ${pageStart} to ${pageEnd}...`)
      
      const slices = await processPDFAutoCrop(pdfDoc)

      if (!slices || slices.length === 0) {
        toast.error('No question markers detected. You can still crop manually!')
        setIsAutoCropping(false)
        return
      }

      // Filter out solution pages based on user-selected page range
      const filteredSlices = slices.filter((s: any) => {
        const pageNum = s.pageNum || s.page || 1
        return pageNum >= pageStart && pageNum <= pageEnd
      })

      if (filteredSlices.length === 0) {
        toast.error(`No questions detected in pages ${pageStart} to ${pageEnd}. Check page range!`)
        setIsAutoCropping(false)
        return
      }

      const newQuestions: Question[] = filteredSlices.map((slice: any, idx: number) => ({
        id: questions.length + idx + 1,
        img: slice.dataUrl,
        page: slice.pageNum || slice.page || pageStart,
        type: 'single',
        choice: null,
        visited: false,
        markedReview: false,
        timeSec: 0,
        eval: 'unattempted',
        awardedMarks: 0,
        officialAnswer: null,
        subject: activeCropSubjectRef.current
      }))

      setQuestions(prev => [...prev, ...newQuestions])
      notify(`Success! ${newQuestions.length} questions captured to queue.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Auto crop encountered an issue. You can crop manually!')
    } finally {
      setIsAutoCropping(false)
    }
  }

  // Instant Bulk Subject Assigner (e.g. Q 1 to 10 -> Physics, Chemistry, Maths)
  const handleApplyBulkSubject = (targetSubj: Subject) => {
    if (questions.length === 0) {
      notify('Question queue is empty!')
      return
    }
    if (bulkFromQ > bulkToQ || bulkFromQ < 1 || bulkToQ > questions.length) {
      toast.error('Invalid question range!')
      return
    }

    setQuestions(prev => prev.map((q, idx) => {
      const qNum = idx + 1
      if (qNum >= bulkFromQ && qNum <= bulkToQ) {
        return { ...q, subject: targetSubj }
      }
      return q
    }))

    notify(`Q#${bulkFromQ} to Q#${bulkToQ} set to ${targetSubj.toUpperCase()}!`)
  }

  // Merge Question with the Next Question in Queue
  const handleMergeWithNext = async (index: number) => {
    if (index >= questions.length - 1) {
      notify('Next question not found to merge!')
      return
    }

    try {
      notify('Merging current question with next part...')
      const currentQ = questions[index]
      const nextQ = questions[index + 1]

      const mergedDataUrl = await mergeTwoQuestions(currentQ.img, nextQ.img)

      setQuestions(prev => {
        const updated = [...prev]
        updated.splice(index, 2, {
          ...currentQ,
          img: mergedDataUrl
        })
        return updated.map((q, i) => ({ ...q, id: i + 1 }))
      })

      notify(`Q#${currentQ.id} and Q#${nextQ.id} merged into a single question!`)
    } catch (err) {
      console.error(err)
      toast.error('Could not merge images.')
    }
  }

  // Question Management
  const handleCropComplete = (dataUrl: string, pageNum: number) => {
    const newQuestion: Question = {
      id: questions.length + 1,
      img: dataUrl,
      page: pageNum,
      type: 'single',
      choice: null,
      visited: false,
      markedReview: false,
      timeSec: 0,
      eval: 'unattempted',
      awardedMarks: 0,
      officialAnswer: null,
      subject: activeCropSubjectRef.current
    }
    
    setQuestions(prev => [...prev, newQuestion])
    notify(`Q#${newQuestion.id} captured into [${newQuestion.subject.toUpperCase()}]!`)
  }

  // Execute Question Split
  const handleExecuteSplit = (img1: string, img2: string) => {
    if (!splittingQuestion) return
    const { index, question } = splittingQuestion

    const part1: Question = {
      ...question,
      img: img1
    }

    const part2: Question = {
      ...question,
      id: question.id + 1,
      img: img2
    }

    setQuestions(prev => {
      const updated = [...prev]
      updated.splice(index, 1, part1, part2)
      return updated.map((q, i) => ({ ...q, id: i + 1 }))
    })

    setSplittingQuestion(null)
    notify('Successfully split into 2 questions!')
  }

  const deleteQuestion = (index: number) => {
    setDeleteConfirmation({
      type: 'question',
      id: String(index),
      onConfirm: () => {
        setQuestions(prev => {
          const updated = prev.filter((_, i) => i !== index)
          return updated.map((q, i) => ({ ...q, id: i + 1 }))
        })
        notify('Question removed from queue.')
      }
    })
  }

  const clearAllQuestions = () => {
    setQuestions([])
    notify('Question queue cleared.')
  }

  // Draft Test Management
  const handleSaveDraft = () => {
    if (questions.length === 0) {
      notify('Please crop questions first!')
      return
    }

    const newDraft: DraftTest = {
      id: generateId('draft'),
      title: draftTitle || currentFileName || `Practice Test #${draftTests.length + 1}`,
      dateStr: formatDate(),
      durationMins: draftDuration,
      questions: [...questions]
    }

    setDraftTests(prev => [newDraft, ...prev])
    saveDraftTests([newDraft, ...draftTests])
    setModal(null)
    notify(`Test "${newDraft.title}" saved!`)
  }

  const loadDraftTest = (draftId: string) => {
    const draft = draftTests.find(d => d.id === draftId)
    if (draft) {
      setQuestions(draft.questions)
      setCurrentFileName(draft.title)
      setExamDuration(draft.durationMins)
      notify(`Loaded "${draft.title}". Launching examination...`)
      launchExam(draft.questions)
    }
  }

  const deleteDraftTest = (draftId: string) => {
    setDeleteConfirmation({
      type: 'draft',
      id: draftId,
      onConfirm: () => {
        setDraftTests(prev => prev.filter(d => d.id !== draftId))
        saveDraftTests(draftTests.filter(d => d.id !== draftId))
        notify('Draft test removed.')
      }
    })
  }

  // Exam Management
  const launchExam = (customQuestions?: Question[]) => {
    const sourceQuestions = customQuestions || questions
    if (sourceQuestions.length === 0) {
      notify('Please add at least one question!')
      return
    }

    const examQuestions: Question[] = sourceQuestions.map((q, i) => ({
      ...q,
      id: i + 1,
      visited: i === 0,
      markedReview: false,
      timeSec: 0,
      eval: 'unattempted',
      awardedMarks: 0,
      officialAnswer: null,
      subject: q.subject || 'physics'
    }))

    setExamData(examQuestions)
    setCurrentQuestionIndex(0)
    setActiveExamSubject(examQuestions[0]?.subject || 'physics')
    setExamActive(true)
    setActive('Start Exam')
    notify('Examination started!')
  }

  const handleQuestionTypeChange = (type: 'single' | 'multi' | 'integer') => {
    setExamData(prev => {
      const updated = [...prev]
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        type,
        choice: null
      }
      return updated
    })
  }

  const handleAnswerChange = (answer: string | string[] | null) => {
    setExamData(prev => {
      const updated = [...prev]
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        choice: answer
      }
      return updated
    })
  }

  const handleQuestionNavigation = (index: number) => {
    setCurrentQuestionIndex(index)
    if (examData[index]?.subject) {
      setActiveExamSubject(examData[index].subject as Subject)
    }
  }

  const handleSaveAndNext = () => {
    if (currentQuestionIndex < examData.length - 1) {
      const nextIdx = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIdx)
      if (examData[nextIdx]?.subject) {
        setActiveExamSubject(examData[nextIdx].subject as Subject)
      }
    } else {
      notify('You are on the last question.')
    }
  }

  const handleMarkForReview = () => {
    setExamData(prev => {
      const updated = [...prev]
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        markedReview: true
      }
      return updated
    })
    if (currentQuestionIndex < examData.length - 1) {
      const nextIdx = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIdx)
      if (examData[nextIdx]?.subject) {
        setActiveExamSubject(examData[nextIdx].subject as Subject)
      }
    }
  }

  const handleClearResponse = () => {
    setExamData(prev => {
      const updated = [...prev]
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        choice: null,
        markedReview: false
      }
      return updated
    })
  }

  const handleTimeUp = () => {
    notify('Time has expired! Submitting test automatically.')
    handleSubmitExam()
  }

  const handleSubmitExam = () => {
    setExamActive(false)
    setShowAnswerKeyImport(true)
    notify('Exam submitted! Please import answer key for evaluation.')
  }

  // Evaluation Management
  const handleEvaluationComplete = (payload?: any) => {
    setShowAnswerKeyImport(false)
    
    let questionsToEvaluate = [...examData]
    let keyMap: Record<string | number, any> | undefined = undefined

    if (Array.isArray(payload)) {
      questionsToEvaluate = payload
    } else if (typeof payload === 'string') {
      keyMap = extractKeyMapFromText(payload)
    } else if (payload && typeof payload === 'object') {
      if (Array.isArray(payload.questions)) {
        questionsToEvaluate = payload.questions
      }
      if (payload.keyMap && typeof payload.keyMap === 'object') {
        keyMap = payload.keyMap
      } else if (!Array.isArray(payload.questions)) {
        const keys = Object.keys(payload)
        if (keys.some(k => !isNaN(Number(k)) || /^\d+$/.test(k))) {
          keyMap = payload
        }
      }
    }

    if (keyMap) {
      questionsToEvaluate = questionsToEvaluate.map((q, idx) => {
        const qNum = Number(String(q.id ?? (idx + 1)).replace(/[^\d]/g, '')) || (idx + 1)
        const official = keyMap![qNum] ?? keyMap![String(qNum)] ?? keyMap![q.id] ?? q.officialAnswer
        const updatedQ = { ...q, officialAnswer: official }
        if (official !== undefined && official !== null) {
          evaluateQuestionWithKey(updatedQ, official)
        }
        return updatedQ
      })
    } else {
      questionsToEvaluate = questionsToEvaluate.map((q) => {
        const updatedQ = { ...q }
        if (updatedQ.officialAnswer !== undefined && updatedQ.officialAnswer !== null) {
          evaluateQuestionWithKey(updatedQ, updatedQ.officialAnswer)
        }
        return updatedQ
      })
    }

    const results = calculateTestResults(questionsToEvaluate, keyMap)
    setExamData(results.normalizedQuestions)
    
    const newRecord: TestRecord = {
      id: generateId('test'),
      title: currentFileName || `Mock Test #${testHistory.length + 1}`,
      dateStr: formatDate(),
      timestamp: Date.now(),
      score: results.score,
      maxScore: results.maxScore,
      accuracy: results.accuracy,
      attemptRate: results.attemptRate,
      attempted: results.attempted,
      totalQuestions: results.totalQuestions,
      correctCount: results.correct,
      partialCount: results.partial,
      wrongCount: results.wrong,
      skippedCount: results.skipped,
      negScore: results.negScore,
      totalTimeSec: results.totalTimeSec,
      percentileText: results.percentileText,
      candidateName: userProfile?.name || 'Candidate',
      questions: results.normalizedQuestions
    }

    setTestHistory(prev => [newRecord, ...prev])
    saveTestHistory([newRecord, ...testHistory])
    
    setSelectedScorecard(newRecord)
    setActive('Results Hub')
    notify('Results calculated! Viewing detailed scorecard...')
  }

  // Test History Management
  const handleDeleteTestRecord = (recordId: string) => {
    setDeleteConfirmation({
      type: 'test',
      id: recordId,
      onConfirm: () => {
        setTestHistory(prev => prev.filter(t => t.id !== recordId))
        saveTestHistory(testHistory.filter(t => t.id !== recordId))
        notify('Test record deleted.')
      }
    })
  }

  const handleClearAllHistory = () => {
    setTestHistory([])
    saveTestHistory([])
    notify('All test history cleared.')
  }

  const handleViewScorecard = (recordId: string) => {
    const record = testHistory.find(t => t.id === recordId)
    if (record) {
      setSelectedScorecard(record)
      setActive('Results Hub')
    }
  }

  const answeredCount = examData.filter(q => hasAttempted(q.choice)).length

  return (
    <div className="app-shell">
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: '#111827', color: '#f8fafc', border: '1px solid #263244' } }} />
      
      {/* Question Split / Edit Modal */}
      {splittingQuestion && (
        <SplitModal 
          question={splittingQuestion.question} 
          onClose={() => setSplittingQuestion(null)} 
          onSplit={handleExecuteSplit} 
        />
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="modal-overlay" onClick={() => setShowOnboarding(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal glass" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">FIRST TIME SETUP</div>
                <h2>Welcome to CBT Studio</h2>
              </div>
              <button className="icon-button" onClick={() => setShowOnboarding(false)}><X /></button>
            </div>
            <p>Please enter your name and target exam. Your sessions and tests will be personalized and saved locally to your device.</p>
            
            <label>Candidate Full Name *</label>
            <input 
              defaultValue={userProfile?.name || ''} 
              placeholder="e.g. Aryan, Priyanshu, Rahul..." 
              id="onboard-name"
            />
            
            <label>Target Examination</label>
            <input 
              defaultValue={userProfile?.target || ''} 
              placeholder="e.g. JEE Main 2026, JEE Advanced, NEET-UG..." 
              id="onboard-target"
            />
            
            <label>Roll / Batch Number (Optional)</label>
            <input 
              defaultValue={userProfile?.roll || ''} 
              placeholder="e.g. BATCH-A / 2026-042" 
              id="onboard-roll"
            />
            
            <div className="modal-actions">
              <button 
                className="primary-button full" 
                onClick={() => {
                  const name = (document.getElementById('onboard-name') as HTMLInputElement)?.value || ''
                  const target = (document.getElementById('onboard-target') as HTMLInputElement)?.value || ''
                  const roll = (document.getElementById('onboard-roll') as HTMLInputElement)?.value || ''
                  handleSaveProfile(name, target, roll)
                }}
              >
                Launch CBT Studio → <Check />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Save Draft Modal */}
      {modal === 'save-draft' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal glass" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">SAVE TEST TO QUESTION BANK</div>
                <h2>Save Test for Later</h2>
              </div>
              <button className="icon-button" onClick={() => setModal(null)}><X /></button>
            </div>
            <p>Save these cropped questions as a draft test. You can attempt it anytime later from your dashboard!</p>
            
            <label>Test Title *</label>
            <input 
              value={draftTitle} 
              onChange={(e) => setDraftTitle(e.target.value)} 
              placeholder="e.g. Thermodynamics Allen Test 03" 
            />
            
            <label>Recommended Time (Minutes)</label>
            <input 
              type="number" 
              value={draftDuration} 
              onChange={(e) => setDraftDuration(Number(e.target.value))} 
              min="5" 
              max="300" 
            />
            
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button className="primary-button" onClick={handleSaveDraft}>Save Draft Test</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Answer Key Import Modal */}
      {showAnswerKeyImport && (
        <div className="modal-overlay" onClick={() => setShowAnswerKeyImport(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal glass large" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">POST-EXAM EVALUATION</div>
                <h2>Answer Key Verification</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAnswerKeyImport(false)}><X /></button>
            </div>
            <AnswerKeyImport 
              questions={examData} 
              onEvaluationComplete={handleEvaluationComplete} 
              onClose={() => setShowAnswerKeyImport(false)} 
            />
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmation(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal glass" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">CONFIRM DELETION</div>
                <h2>Are you sure?</h2>
              </div>
              <button className="icon-button" onClick={() => setDeleteConfirmation(null)}><X /></button>
            </div>
            <p>Are you sure you want to delete this {deleteConfirmation.type === 'draft' ? 'saved test' : deleteConfirmation.type === 'question' ? 'question' : 'test record'}? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeleteConfirmation(null)}>Cancel</button>
              <button 
                className="primary-button" 
                style={{ background: 'linear-gradient(135deg, #f43f5e, #fb7185)', boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)' }}
                onClick={() => {
                  deleteConfirmation.onConfirm()
                  setDeleteConfirmation(null)
                }}
              >
                <Trash2 /> Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Zap /></div>
          {!collapsed && (
            <div>
              <div className="brand-name">CBT <span>//</span> STUDIO</div>
              <div className="brand-sub">EXAM OPERATING SYSTEM</div>
            </div>
          )}
          <button className="icon-button sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
            <PanelLeft />
          </button>
        </div>
        
        <div className="side-section-label">WORKSPACE</div>
        <nav className="nav-list">
          {nav.map(({ label, icon: Icon, color }) => (
            <button 
              key={label} 
              onClick={() => navTo(label)} 
              className={`nav-item ${active === label ? 'active' : ''}`} 
              title={collapsed ? label : undefined}
              style={active === label ? { boxShadow: '0 0 15px rgba(139, 92, 246, 0.5)' } : undefined}
            >
              <span className={`nav-icon-box nav-icon-${color}`}>
                <Icon />
              </span>
              {!collapsed && <span>{label}</span>}
              {active === label && !collapsed && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        
        {!collapsed && (
          <div className="sidebar-bottom">
            <div className="profile-pill" onClick={() => setModal('profile')}>
              <div className="avatar">{userProfile ? getInitials(userProfile.name) : 'CB'}</div>
              <div className="profile-copy">
                <b>{userProfile?.name || 'Candidate'}</b>
                <span>{userProfile?.target || 'JEE Aspirant'}</span>
              </div>
              <MoreHorizontal />
            </div>
            <div className="crafted">Crafted with <Zap /> by Manav</div>
          </div>
        )}
      </aside>

      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="search-box">
            <Search />
            <span>Search tests, question archives...</span>
            <kbd><Command /> K</kbd>
          </div>
          <div className="topbar-right">
            <div className="live-clock">
              <span className="live-dot" />
              {clock.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })} 
              <b className="mono">{clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</b>
            </div>
            <button className="icon-button notification"><Bell /><i /></button>
            <button className="candidate-status" onClick={() => setShowProfile(!showProfile)}>
              <div className="avatar small">{userProfile ? getInitials(userProfile.name) : 'CB'}</div>
              <span>{userProfile?.name?.split(' ')[0] || 'Candidate'}</span>
              <ChevronDown />
            </button>
            {showProfile && (
              <div className="profile-popover">
                <b>{userProfile?.name || 'Candidate'}</b>
                <span>{userProfile?.target || 'JEE Aspirant'}</span>
                <button onClick={() => setModal('profile')}><Pencil /> Edit profile</button>
                <button onClick={() => notify('Signed out securely')}><History /> Sign out</button>
              </div>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div 
            key={active} 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.2 }} 
            className="content-wrap"
            style={{ flex: 1, overflowY: 'auto' }}
          >
            {active === 'Dashboard' && (
              <Dashboard 
                notify={notify} 
                setActive={setActive} 
                setModal={setModal}
                userProfile={userProfile}
                questions={questions}
                draftTests={draftTests}
                testHistory={testHistory}
                onLoadDraft={loadDraftTest}
                onDeleteDraft={deleteDraftTest}
                onViewScorecard={handleViewScorecard}
                onLaunchExam={launchExam}
              />
            )}
            
            {(active === 'Upload & Extract' || active === 'Question Queue') && (
              <Studio 
                notify={notify} 
                setModal={setModal}
                loading={loading}
                error={error}
                totalPages={totalPages}
                zoom={zoom}
                pagesData={pagesData}
                pdfDoc={pdfDoc}
                onPDFUpload={handlePDFUpload}
                onZoomChange={setZoom}
                onResetZoom={resetZoom}
                onCropComplete={handleCropComplete}
                questions={questions}
                onDeleteQuestion={deleteQuestion}
                onClearQuestions={clearAllQuestions}
                onSplitQuestion={(q: Question, idx: number) => setSplittingQuestion({ question: q, index: idx })}
                onMergeWithNext={handleMergeWithNext}
                currentFileName={currentFileName}
                activeSubject={activeCropSubject}
                onSubjectChange={setActiveCropSubject}
                onLaunchExam={launchExam}
                onRunAutoCrop={handleRunAutoCrop}
                isAutoCropping={isAutoCropping}
                pageStart={pageStart}
                pageEnd={pageEnd}
                onPageStartChange={setPageStart}
                onPageEndChange={setPageEnd}
                bulkFromQ={bulkFromQ}
                bulkToQ={bulkToQ}
                onBulkFromChange={setBulkFromQ}
                onBulkToChange={setBulkToQ}
                onApplyBulkSubject={handleApplyBulkSubject}
              />
            )}
            
            {active === 'Saved Tests Bank' && (
              <SavedTests 
                notify={notify} 
                draftTests={draftTests}
                onLoadDraft={loadDraftTest}
                onDeleteDraft={deleteDraftTest}
              />
            )}
            
            {active === 'Start Exam' && examActive && (
              <ExamArena 
                examData={examData}
                currentIndex={currentQuestionIndex}
                onQuestionSelect={handleQuestionNavigation}
                onTypeChange={handleQuestionTypeChange}
                onAnswerChange={handleAnswerChange}
                onSaveAndNext={handleSaveAndNext}
                onMarkForReview={handleMarkForReview}
                onClearResponse={handleClearResponse}
                onSubmit={handleSubmitExam}
                onTimeUp={handleTimeUp}
                duration={examDuration}
                answeredCount={answeredCount}
                userProfile={userProfile}
                examActive={examActive}
                activeSubject={activeExamSubject}
                onSubjectChange={(subj: Subject) => {
                  setActiveExamSubject(subj)
                  const firstIdxOfSub = examData.findIndex(q => (q.subject || 'physics') === subj)
                  if (firstIdxOfSub !== -1) {
                    setCurrentQuestionIndex(firstIdxOfSub)
                  }
                }}
              />
            )}
            
            {!examActive && active === 'Start Exam' && (
              <div className="empty-state">
                <div className="empty-icon">▷</div>
                <b>No active exam</b>
                <span>Upload a PDF and crop questions to start an examination.</span>
                <button className="primary-button" onClick={() => setActive('Upload & Extract')}>
                  <UploadCloud /> Go to Upload
                </button>
              </div>
            )}
            
            {active === 'Results Hub' && !selectedScorecard && (
              <ResultsHub 
                testHistory={testHistory}
                onViewScorecard={handleViewScorecard}
                onNewTest={() => setActive('Upload & Extract')}
                onClearHistory={handleClearAllHistory}
                onDeleteRecord={handleDeleteTestRecord}
              />
            )}
            
            {active === 'Results Hub' && selectedScorecard && (
              <Scorecard 
                record={selectedScorecard}
                onBack={() => setSelectedScorecard(null)}
                onNewTest={() => setActive('Upload & Extract')}
                onDelete={() => {
                  handleDeleteTestRecord(selectedScorecard.id)
                  setSelectedScorecard(null)
                }}
              />
            )}
            
            {active === 'Profile Settings' && (
              <Profile 
                userProfile={userProfile}
                onSaveProfile={handleSaveProfile}
                setModal={setModal} 
                notify={notify} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {modal === 'profile' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal glass" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="eyebrow">CBT STUDIO</div>
                <h2>Candidate profile</h2>
              </div>
              <button className="icon-button" onClick={() => setModal(null)}><X /></button>
            </div>
            <div className="profile-modal-head">
              <div className="avatar large">{userProfile ? getInitials(userProfile.name) : 'CB'}</div>
              <div>
                <h3>{userProfile?.name || 'Candidate'}</h3>
                <p>{userProfile?.target || 'JEE Aspirant'}</p>
              </div>
              <button className="icon-button"><Pencil /></button>
            </div>
            <label>Candidate name</label>
            <input defaultValue={userProfile?.name || ''} id="profile-name" />
            <label>Target exam</label>
            <select defaultValue={userProfile?.target || 'JEE Advanced 2026'} id="profile-target">
              <option>JEE Advanced 2026</option>
              <option>JEE Main 2026</option>
              <option>NEET-UG</option>
            </select>
            <button 
              className="primary-button full" 
              onClick={() => {
                const name = (document.getElementById('profile-name') as HTMLInputElement)?.value || ''
                const target = (document.getElementById('profile-target') as HTMLInputElement)?.value || ''
                handleSaveProfile(name, target)
              }}
            >
              Save profile <Check />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Dashboard Component
function Dashboard({ notify, setActive, setModal, userProfile, questions, draftTests, testHistory, onLoadDraft, onDeleteDraft, onViewScorecard, onLaunchExam }: any) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> PERSONAL COMMAND CENTER</div>
          <h1>Welcome back, {userProfile?.name?.split(' ')[0] || 'Candidate'}<span className="gradient-text">.</span></h1>
          <p>Small, consistent reps build impossible scores. Your next breakthrough is queued.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => notify('Opening your activity log')}><Activity /> Activity</button>
          {questions.length > 0 ? (
            <button className="primary-button" onClick={() => onLaunchExam()}><Play /> Start Exam ({questions.length})</button>
          ) : (
            <button className="primary-button" onClick={() => setActive('Upload & Extract')}><Plus /> New test</button>
          )}
        </div>
      </div>
      
      <div className="stats-grid">
        <StatCard icon={FileArchive} label="Active PDF" value={questions.length > 0 ? '01' : '0'} detail={questions.length > 0 ? 'Ready to extract' : 'No active file'} accent="violet" />
        <StatCard icon={ListChecks} label="Ready questions" value={questions.length} detail={`${questions.length} items captured`} accent="cyan" />
        <StatCard icon={Check} label="Tests completed" value={testHistory.length} detail={`${testHistory.length} saved in history`} accent="mint" />
        <StatCard icon={Target} label="Best score" value={testHistory.length > 0 ? testHistory[0]?.score || '0' : '—'} detail={testHistory.length > 0 ? `Top performance` : 'No attempts yet'} accent="rose" />
      </div>

      <div className="dashboard-grid">
        <section className="glass queue-panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">CAPTURED FROM PDF</div>
              <h2>Question queue <Pill color="cyan">{questions.length} ready</Pill></h2>
            </div>
            <button className="text-button" onClick={() => setActive('Question Queue')}>View all <ArrowUpRight /></button>
          </div>
          
          {questions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▱</div>
              <b>No cropped questions yet</b>
              <span>Upload a PDF below. Scroll freely through all pages and drag to crop questions!</span>
            </div>
          ) : (
            <div className="queue-list">
              {questions.slice(0, 3).map((q, index) => (
                <div className="queue-item" key={q.id}>
                  <img src={q.img} className="queue-thumb" alt={`Q${q.id}`} />
                  <div className="queue-copy">
                    <b>Q{q.id < 10 ? '0' : ''}{q.id} // {(q.subject || 'physics').toUpperCase()}</b>
                    <span><Pill>Page {q.page}</Pill> <span className="mono">• Captured</span></span>
                  </div>
                  <button className="icon-button subtle" onClick={() => notify('Question removed from queue')}><Trash2 /></button>
                </div>
              ))}
            </div>
          )}
          
          <button className="outline-button full" onClick={() => setActive('Upload & Extract')}>
            <UploadCloud /> Add more questions
          </button>
        </section>

        <section className="glass upload-panel">
          <div className="upload-glow" />
          <div className="eyebrow">QUESTION INGESTION</div>
          <h2>Upload & Extract</h2>
          <p>Drag & drop your question paper PDF here or click to browse</p>
          <button className="primary-button" onClick={() => setActive('Upload & Extract')}>
            <UploadCloud /> Upload PDF
          </button>
        </section>
      </div>

      <div className="section-heading">
        <h2>Saved Tests Bank</h2>
        <span className="records-count">{draftTests.length} {draftTests.length === 1 ? 'test' : 'tests'} stored</span>
      </div>

      {draftTests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <b>No saved tests yet</b>
          <span>Crop questions from any paper and click "Save Test for Later" to store it here.</span>
        </div>
      ) : (
        <div className="test-grid expanded">
          {draftTests.map((test: DraftTest) => (
            <motion.div 
              key={test.id} 
              whileHover={{ y: -4 }} 
              className="test-card glass"
            >
              <div className="test-card-top">
                <Pill color="violet">DRAFT</Pill>
                <button className="icon-button subtle" onClick={() => onDeleteDraft(test.id)}><Trash2 /></button>
              </div>
              <h3>{test.title}</h3>
              <div className="test-meta">
                <span><FileText /> {test.questions.length} questions</span>
                <span><Clock3 /> {test.durationMins} min</span>
              </div>
              <div className="test-footer">
                <small>Saved {test.dateStr}</small>
                <button className="mini-button" onClick={() => onLoadDraft(test.id)}>Attempt <ArrowUpRight /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {testHistory.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Recent Test History</h2>
            <button className="text-button" onClick={() => setActive('Results Hub')}>View all <ArrowUpRight /></button>
          </div>
          <div className="test-grid expanded">
            {testHistory.slice(0, 3).map((test: TestRecord) => (
              <motion.div 
                key={test.id} 
                whileHover={{ y: -4 }} 
                className="test-card glass"
              >
                <div className="test-card-top">
                  <Pill color="cyan">COMPLETED</Pill>
                </div>
                <h3>{test.title}</h3>
                <div className="test-meta">
                  <span><FileText /> {test.totalQuestions} questions</span>
                  <span><Clock3 /> {Math.round(test.totalTimeSec / 60)} min</span>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${(test.score / test.maxScore) * 100}%` }} />
                </div>
                <div className="test-footer">
                  <small>{test.dateStr}</small>
                  <button className="mini-button" onClick={() => onViewScorecard(test.id)}>View <ArrowUpRight /></button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function PDFPage({ pageData, totalPages, onCrop }: { pageData: any, totalPages: number, onCrop: (dataUrl: string, pageNum: number) => void }) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragCurrent, setDragCurrent] = useState({ width: 0, height: 0 })
  const [canvasReady, setCanvasReady] = useState(false)

  useEffect(() => {
    if (pdfCanvasRef.current && pageData.canvas) {
      const canvas = pdfCanvasRef.current
      canvas.width = pageData.canvas.width
      canvas.height = pageData.canvas.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(pageData.canvas, 0, 0)
        setCanvasReady(true)
      }
    }
    if (cropCanvasRef.current && pageData.cropCanvas) {
      const canvas = cropCanvasRef.current
      canvas.width = pageData.cropCanvas.width
      canvas.height = pageData.cropCanvas.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(pageData.cropCanvas, 0, 0)
      }
    }
  }, [pageData])

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropCanvasRef.current) return { x: 0, y: 0 }
    const rect = cropCanvasRef.current.getBoundingClientRect()
    const scaleX = cropCanvasRef.current.width / rect.width
    const scaleY = cropCanvasRef.current.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getCoords(e)
    setIsDragging(true)
    setDragStart(pos)
    setDragCurrent({ width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !cropCanvasRef.current) return
    
    const pos = getCoords(e)
    const width = pos.x - dragStart.x
    const height = pos.y - dragStart.y
    
    setDragCurrent({ width, height })
    
    const ctx = cropCanvasRef.current.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, cropCanvasRef.current.width, cropCanvasRef.current.height)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
      ctx.fillRect(0, 0, cropCanvasRef.current.width, cropCanvasRef.current.height)
      
      const rx = width < 0 ? dragStart.x + width : dragStart.x
      const ry = height < 0 ? dragStart.y + height : dragStart.y
      const rw = Math.abs(width)
      const rh = Math.abs(height)
      
      ctx.clearRect(rx, ry, rw, rh)
      
      ctx.strokeStyle = '#56e4ff'
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rx, ry, rw, rh)
    }
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    
    const rw = Math.abs(dragCurrent.width)
    const rh = Math.abs(dragCurrent.height)
    
    if (cropCanvasRef.current) {
      const ctx = cropCanvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, cropCanvasRef.current.width, cropCanvasRef.current.height)
      }
    }
    
    if (rw > 32 && rh > 32 && pdfCanvasRef.current) {
      const rx = dragCurrent.width < 0 ? dragStart.x + dragCurrent.width : dragStart.x
      const ry = dragCurrent.height < 0 ? dragStart.y + dragCurrent.height : dragStart.y
      
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = rw
      tempCanvas.height = rh
      const tCtx = tempCanvas.getContext('2d')
      
      if (tCtx) {
        tCtx.drawImage(pdfCanvasRef.current, rx, ry, rw, rh, 0, 0, rw, rh)
        const dataUrl = tempCanvas.toDataURL('image/png')
        onCrop(dataUrl, pageData.pageNum)
      }
    }
    
    setDragCurrent({ width: 0, height: 0 })
  }

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp()
    }
  }

  return (
    <div className="pdf-page-wrapper">
      <div className="page-watermark">PAGE {pageData.pageNum} / {totalPages}</div>
      <canvas 
        ref={pdfCanvasRef} 
        className="pdf-canvas-element" 
        style={{ opacity: canvasReady ? 1 : 0.5 }} 
      />
      <canvas 
        ref={cropCanvasRef} 
        className="pdf-crop-canvas" 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onMouseLeave={handleMouseLeave} 
      />
    </div>
  )
}

// Studio Component (PDF Upload, Auto Detect + Manual Crop with Split, Merge & Direct Range Section Assigner)
function Studio({ 
  notify, setModal, loading, error, totalPages, zoom, pagesData, pdfDoc,
  onPDFUpload, onZoomChange, onResetZoom, onCropComplete, questions, 
  onDeleteQuestion, onClearQuestions, onSplitQuestion, onMergeWithNext, currentFileName, activeSubject, onSubjectChange, onLaunchExam,
  onRunAutoCrop, isAutoCropping, pageStart, pageEnd, onPageStartChange, onPageEndChange,
  bulkFromQ, bulkToQ, onBulkFromChange, onBulkToChange, onApplyBulkSubject
}: any) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filterSubject, setFilterSubject] = useState<'all' | Subject>('all')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onPDFUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      onPDFUpload(file)
    }
  }

  const filteredQuestions = filterSubject === 'all' 
    ? questions 
    : questions.filter((q: Question) => (q.subject || 'physics') === filterSubject)

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="live-dot cyan" /> EXTRACTION STUDIO</div>
          <h1>Crop with intent<span className="gradient-text">.</span></h1>
          <p>{currentFileName || 'No PDF loaded'} <Pill color="cyan">{totalPages} pages</Pill></p>
        </div>
        <div className="heading-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {totalPages > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>PAGES:</span>
              <input 
                type="number" 
                min={1} 
                max={pageEnd} 
                value={pageStart} 
                onChange={(e) => onPageStartChange(Math.max(1, Number(e.target.value)))}
                style={{ width: '42px', background: '#0b0f19', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', textAlign: 'center', fontSize: '12px', padding: '3px', fontWeight: 700 }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
              <input 
                type="number" 
                min={pageStart} 
                max={totalPages || 1} 
                value={pageEnd} 
                onChange={(e) => onPageEndChange(Math.min(totalPages, Number(e.target.value)))}
                style={{ width: '42px', background: '#0b0f19', border: '1px solid #334155', color: '#38bdf8', borderRadius: '6px', textAlign: 'center', fontSize: '12px', padding: '3px', fontWeight: 700 }}
              />
            </div>
          )}

          {totalPages > 0 && (
            <button 
              className="primary-button"
              onClick={onRunAutoCrop}
              disabled={isAutoCropping}
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
              }}
            >
              {isAutoCropping ? <><Loader2 className="animate-spin" /> Detecting...</> : <><Zap /> ⚡ Auto Detect ({pageStart}–{pageEnd})</>}
            </button>
          )}

          <button className="secondary-button" onClick={onClearQuestions}><RotateCcw /> Clear queue</button>
          <button className="secondary-button" onClick={() => setModal('save-draft')}><SaveIcon /> Save draft</button>
          {questions.length > 0 && (
            <button className="primary-button" onClick={() => onLaunchExam()}><Play /> Launch Exam ({questions.length})</button>
          )}
        </div>
      </div>

      {/* Direct Range Section Assigner Bar (e.g. Q 1 to 10 -> PHY / CHEM / MATHS) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: 'rgba(18, 18, 30, 0.85)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '14px', padding: '10px 18px', backdropFilter: 'blur(10px)', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#38bdf8', textTransform: 'uppercase' }}>
            ⚡ QUICK SECTION TAGGER:
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Assign Q</span>
          <input 
            type="number" 
            min={1} 
            max={bulkToQ} 
            value={bulkFromQ} 
            onChange={(e) => onBulkFromChange(Math.max(1, Number(e.target.value)))}
            style={{ width: '48px', background: '#0b0f19', border: '1px solid #334155', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '12px', padding: '4px', fontWeight: 700 }}
          />
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>to Q</span>
          <input 
            type="number" 
            min={bulkFromQ} 
            max={questions.length || 1} 
            value={bulkToQ} 
            onChange={(e) => onBulkToChange(Math.max(1, Number(e.target.value)))}
            style={{ width: '48px', background: '#0b0f19', border: '1px solid #334155', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '12px', padding: '4px', fontWeight: 700 }}
          />
          <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px' }}>as:</span>

          <button
            onClick={() => onApplyBulkSubject('physics')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              border: '1px solid #a855f7',
              background: 'rgba(168, 85, 247, 0.18)',
              color: '#d8b4fe',
              transition: 'all 0.15s ease'
            }}
          >
            Physics
          </button>
          <button
            onClick={() => onApplyBulkSubject('chemistry')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              border: '1px solid #06b6d4',
              background: 'rgba(6, 182, 212, 0.18)',
              color: '#67e8f9',
              transition: 'all 0.15s ease'
            }}
          >
            Chemistry
          </button>
          <button
            onClick={() => onApplyBulkSubject('maths')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              border: '1px solid #10b981',
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#6ee7b7',
              transition: 'all 0.15s ease'
            }}
          >
            Maths
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Active Manual Subject:</span>
          {(['physics', 'chemistry', 'maths'] as Subject[]).map((subj) => (
            <button
              key={subj}
              onClick={() => onSubjectChange(subj)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: activeSubject === subj ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)',
                background: activeSubject === subj ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.03)',
                color: activeSubject === subj ? '#ffffff' : '#94a3b8'
              }}
            >
              {subj.slice(0, 4)}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-toolbar glass">
        <div className="toolbar-group">
          <span className="eyebrow">PAGE</span>
          <b className="mono">{totalPages} <small>pages</small></b>
        </div>
        <div className="toolbar-group center">
          <Pill color="mint">NEXT: Q{questions.length + 1}</Pill>
          <span className="toolbar-divider" />
          <button className="icon-button" onClick={() => onZoomChange(zoom - 0.15)}><ZoomOut /></button>
          <span className="mono">{Math.round(zoom * 100)}%</span>
          <button className="icon-button" onClick={() => onZoomChange(zoom + 0.15)}><ZoomIn /></button>
        </div>
        <div className="toolbar-group">
          <span className="eyebrow">CAPTURED</span>
          <b className="mono accent-number">{questions.length}</b>
        </div>
      </div>

      {totalPages === 0 ? (
        <div className="upload-card" onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
          <div className="upload-icon"><UploadCloud /></div>
          <h3>Upload Test Paper PDF</h3>
          <p>Drag & drop your question paper PDF here or click to browse from device</p>
          <button className="primary-button">Browse PDF File</button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="application/pdf" 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <small>Compatible with Allen, Resonance, FIITJEE & NTA PDFs</small>
        </div>
      ) : (
        <div className="studio-layout" style={{ height: 'calc(100vh - 250px)', minHeight: '400px', overflow: 'hidden' }}>
          <div className="pdf-canvas" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
            <div className="page-ruler mono" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(9,9,11,0.92)', padding: '6px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span>{totalPages} PAGES LOADED • DRAG TO MANUAL CROP</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Filter: Page {pageStart} to {pageEnd}</span>
                <button 
                  onClick={onRunAutoCrop}
                  disabled={isAutoCropping}
                  style={{
                    background: 'rgba(6, 182, 212, 0.2)',
                    border: '1px solid #06b6d4',
                    color: '#67e8f9',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isAutoCropping ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} 
                  ⚡ Auto Detect Questions
                </button>
              </div>
            </div>
            <div className="pdf-pages-container">
              {pagesData.map((pageData: any) => (
                <PDFPage 
                  key={pageData.pageNum} 
                  pageData={pageData} 
                  totalPages={totalPages} 
                  onCrop={onCropComplete} 
                />
              ))}
            </div>
          </div>

          <div className="crop-rail" style={{ position: 'sticky', top: '4px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="crop-rail-head" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <b>Live Cropped Queue</b>
              <span className="cyber-badge">{questions.length} ITEMS</span>
            </div>

            {/* Filter buttons in Queue */}
            <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', background: 'rgba(10, 10, 18, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {(['all', 'physics', 'chemistry', 'maths'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterSubject(tab)}
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '4px 0',
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    border: filterSubject === tab ? '1px solid #a855f7' : '1px solid transparent',
                    background: filterSubject === tab ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                    color: filterSubject === tab ? '#e9d5ff' : '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  {tab === 'all' ? 'All' : tab.slice(0, 4)}
                </button>
              ))}
            </div>

            <div className="crop-rail-list" style={{ overflowY: 'auto', flex: 1 }}>
              {filteredQuestions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✂</div>
                  <b>No questions here</b>
                  <span>Click "⚡ Auto Detect" or drag on PDF to crop.</span>
                </div>
              ) : (
                filteredQuestions.map((q: Question, index: number) => {
                  const originalIndex = questions.findIndex((item: Question) => item.id === q.id)
                  const canMerge = originalIndex < questions.length - 1
                  return (
                    <div key={q.id} className="rail-crop-card">
                      <div className="rail-crop-head">
                        <span className="rail-crop-title">Q#{q.id < 10 ? '0' : ''}{q.id} • {(q.subject || 'physics').toUpperCase()}</span>
                        <span className="rail-crop-page">Page {q.page}</span>
                      </div>
                      <div className="rail-crop-img-wrap">
                        <img src={q.img} alt={`Q${q.id}`} />
                      </div>
                      <div className="rail-crop-actions">
                        {/* Merge With Next Button */}
                        {canMerge && (
                          <button 
                            className="icon-button subtle" 
                            onClick={() => onMergeWithNext(originalIndex)}
                            title="Merge this question with the next part below"
                            style={{ color: '#a855f7' }}
                          >
                            <Link2 size={14} />
                          </button>
                        )}
                        {/* Split Button for questions that merged together */}
                        <button 
                          className="icon-button subtle" 
                          onClick={() => onSplitQuestion(q, originalIndex)}
                          title="Split merged question (e.g. Q5 + Q6)"
                          style={{ color: '#06b6d4' }}
                        >
                          <Scissors size={14} />
                        </button>
                        <button className="icon-button subtle" onClick={() => notify(`Question #${q.id} (${q.subject || 'physics'})`)}>
                          <ZoomIn />
                        </button>
                        <button className="icon-button subtle" onClick={() => onDeleteQuestion(originalIndex)}>
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SavedTests({ notify, draftTests, onLoadDraft, onDeleteDraft }: any) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LIBRARY <span className="gradient-text">//</span> SAVED TESTS</div>
          <h1>Your test bank<span className="gradient-text">.</span></h1>
          <p>Curated sets for deliberate practice.</p>
        </div>
        <button className="primary-button" onClick={() => notify('Crop questions and click Save Draft')}>
          <Plus /> Create test
        </button>
      </div>

      {draftTests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <b>No saved tests yet</b>
          <span>Crop questions from any paper and save them as draft tests here.</span>
        </div>
      ) : (
        <div className="test-grid expanded">
          {draftTests.map((test: DraftTest) => (
            <motion.div 
              key={test.id} 
              whileHover={{ y: -4 }} 
              className="test-card glass"
            >
              <div className="test-card-top">
                <Pill color="violet">DRAFT</Pill>
                <button className="icon-button subtle" onClick={() => onDeleteDraft(test.id)}><Trash2 /></button>
              </div>
              <h3>{test.title}</h3>
              <div className="test-meta">
                <span><FileText /> {test.questions.length} questions</span>
                <span><Clock3 /> {test.durationMins} min</span>
              </div>
              <div className="test-footer">
                <small>Saved {test.dateStr}</small>
                <button className="mini-button" onClick={() => onLoadDraft(test.id)}>Attempt <ArrowUpRight /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </>
  )
}

// Exam Arena Component with Subject Navigation Tabs
function ExamArena({ 
  examData, currentIndex, onQuestionSelect, onTypeChange, onAnswerChange, 
  onSaveAndNext, onMarkForReview, onClearResponse, onSubmit, onTimeUp, 
  duration, answeredCount, userProfile, examActive, activeSubject, onSubjectChange 
}: any) {
  const currentQuestion = examData[currentIndex]

  if (!currentQuestion) return null

  return (
    <div className="exam-page">
      <div className="exam-top">
        <div>
          <div className="eyebrow">QUESTION <span className="gradient-text">//</span> {currentIndex + 1 < 10 ? '0' : ''}{currentIndex + 1}</div>
          <h1>Examination Mode</h1>
        </div>
        <div className="exam-top-right">
          <Pill color="rose">+4 / −2 (Adv Partial)</Pill>
          <div className="exam-candidate">
            <div className="avatar small">{userProfile ? getInitials(userProfile.name) : 'CB'}</div>
            <span>{userProfile?.name || 'Candidate'}</span>
          </div>
        </div>
      </div>

      {/* Top Subject Tab Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: '12px',
        marginBottom: '16px',
        background: 'rgba(15, 15, 26, 0.75)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginRight: '4px' }}>
          SECTION:
        </div>
        {(['physics', 'chemistry', 'maths'] as Subject[]).map((subj) => {
          const count = examData.filter((q: Question) => (q.subject || 'physics') === subj).length
          const isSelected = activeSubject === subj
          return (
            <button
              key={subj}
              onClick={() => onSubjectChange(subj)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#ffffff' : '#94a3b8',
                boxShadow: isSelected ? '0 0 16px rgba(147, 51, 234, 0.45)' : 'none'
              }}
            >
              <span>{subj}</span>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '999px',
                background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)',
                color: isSelected ? '#fff' : '#64748b'
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="exam-layout">
        <section className="question-column">
          <div className="question-tabs">
            {['Single Choice', 'Multiple Correct', 'Numerical'].map((type) => (
              <button 
                key={type} 
                className={currentQuestion.type === (type === 'Single Choice' ? 'single' : type === 'Multiple Correct' ? 'multi' : 'integer') ? 'selected' : ''} 
                onClick={() => onTypeChange(type === 'Single Choice' ? 'single' : type === 'Multiple Correct' ? 'multi' : 'integer')}
              >
                {type === 'Single Choice' ? '◉' : type === 'Multiple Correct' ? '☑' : '#'} {type}
              </button>
            ))}
          </div>

          <div className="question-billboard glass">
            <div className="billboard-toolbar">
              <Pill color="violet">Q{currentIndex + 1} • {(currentQuestion.subject || 'physics').toUpperCase()}</Pill>
              <div>
                <button className="icon-button"><ZoomOut /></button>
                <button className="icon-button"><ZoomIn /></button>
                <button className="icon-button"><MoreHorizontal /></button>
              </div>
            </div>
            <div className="question-content">
              <div className="question-number mono">{currentIndex + 1}.</div>
              <div>
                <img src={currentQuestion.img} alt={`Question ${currentIndex + 1}`} className="question-image" />
              </div>
            </div>
          </div>

          <AnswerInputs 
            question={currentQuestion} 
            onAnswerChange={onAnswerChange} 
          />

          <div className="exam-actions">
            <button className="secondary-button" onClick={() => onQuestionSelect(currentIndex - 1)} disabled={currentIndex === 0}>
              <ChevronLeft /> Previous
            </button>
            <button className="secondary-button" onClick={onMarkForReview}>
              <Star /> Mark for Review
            </button>
            <button className="secondary-button" onClick={onClearResponse}>
              <RotateCcw /> Clear Response
            </button>
            <button className="primary-button" onClick={onSaveAndNext}>
              Save & Next <ChevronRight />
            </button>
          </div>
        </section>

        <div className="exam-dock">
          <ExamTimer initialMinutes={duration} onTimeUp={onTimeUp} isActive={examActive} />
          
          <div className="palette-legend">
            <div className="leg-item"><span className="leg-badge ans">✓</span> Answered</div>
            <div className="leg-item"><span className="leg-badge not-ans">✕</span> Not Answered</div>
            <div className="leg-item"><span className="leg-badge review">★</span> Marked Review</div>
            <div className="leg-item"><span className="leg-badge not-vis">⊘</span> Not Visited</div>
          </div>

          <QuestionPalette 
            questions={examData}
            currentIndex={currentIndex}
            onQuestionSelect={onQuestionSelect}
            answeredCount={answeredCount}
          />

          <button className="submit-button" onClick={onSubmit}>
            Submit Examination
          </button>
        </div>
      </div>
    </div>
  )
}

function Profile({ userProfile, onSaveProfile, setModal, notify }: any) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNT <span className="gradient-text">//</span> PROFILE</div>
          <h1>Candidate settings<span className="gradient-text">.</span></h1>
          <p>Keep your exam context tuned to your target.</p>
        </div>
        <button className="primary-button" onClick={() => setModal('profile')}>
          <Pencil /> Edit profile
        </button>
      </div>

      <div className="profile-settings-grid">
        <div className="glass profile-card">
          <div className="avatar xlarge">{userProfile ? getInitials(userProfile.name) : 'CB'}</div>
          <h2>{userProfile?.name || 'Candidate'}</h2>
          <Pill color="violet">{userProfile?.target || 'JEE Aspirant'}</Pill>
          <p>Focused on building accuracy under pressure.</p>
          <button className="outline-button" onClick={() => notify('Avatar upload ready')}>
            <UploadCloud /> Change avatar
          </button>
        </div>

        <div className="glass preference-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">PREFERENCES</div>
              <h2>Exam environment</h2>
            </div>
            <Settings2 />
          </div>
          {[
            ['Default duration', '180 minutes'],
            ['Marking scheme', '+4 / −2 (Adv Partial)'],
            ['Sections', 'Physics, Chemistry, Maths'],
            ['Ambient sound', 'Off']
          ].map(([a, b]) => (
            <div className="preference-row" key={a}>
              <span>{a}</span>
              <b>{b} <ChevronRight /></b>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
