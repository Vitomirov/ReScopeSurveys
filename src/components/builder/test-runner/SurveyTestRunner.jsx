import { useState, useMemo } from 'react'
import {
  X, Play, PlayCircle, CheckCircle2, XCircle,
  GitBranch, List, Loader2,
} from 'lucide-react'
import { DEFAULT_SURVEY_TITLE } from '@/constants/survey/surveyDefaults'
import { analyzeBranches } from './branchAnalysis'
import { runSimulation } from './simulationEngine'
import { BranchIcon, LogEntry, AllResultsTable } from './TestRunnerUI'

export function SurveyTestRunner({ survey, items, onClose }) {
  const branches = useMemo(() => analyzeBranches(items), [items])
  const [selectedId, setSelectedId]       = useState(branches[0]?.id)
  const [result, setResult]               = useState(null)
  const [isRunning, setIsRunning]         = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)

  const selectedBranch = branches.find(b => b.id === selectedId)
  const questionCount  = items.filter(i => i.itemType === 'question').length
  const pageCount      = items.filter(i => i.itemType === 'page_break').length + 1

  const runBranch = (branch) => {
    setIsRunning(true)
    setShowAllResults(false)
    setTimeout(() => {
      const sim = runSimulation(items, survey, branch)
      setResult(sim)
      setIsRunning(false)
    }, 300)
  }

  const runAll = () => {
    setIsRunning(true)
    setShowAllResults(false)
    setTimeout(() => {
      const results = branches.map(b => ({ branch: b, ...runSimulation(items, survey, b) }))
      setResult({ allResults: results })
      setShowAllResults(true)
      setIsRunning(false)
    }, 400)
  }

  const noBranches = branches.length <= 1

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <PlayCircle size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-ink-800">Survey Test Runner</h2>
            <p className="text-xs text-ink-400">
              {survey.title || DEFAULT_SURVEY_TITLE} · {questionCount} question{questionCount !== 1 ? 's' : ''} · {pageCount} page{pageCount !== 1 ? 's' : ''} · {branches.length} branch{branches.length !== 1 ? 'es' : ''} detected
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">

          {/* Left: Branch selector */}
          <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-ink-100 flex flex-col max-h-[35vh] md:max-h-none">
            <div className="px-4 py-3 border-b border-ink-100">
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch size={11} /> Detected branches
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {noBranches && (
                <div className="p-3 text-xs text-ink-400 italic">
                  No conditional logic found. Only the clean completion path is available.
                  Add termination rules or termination blocks to see more branches.
                </div>
              )}
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedId(b.id); setResult(null) }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${
                    selectedId === b.id
                      ? 'border-brand-400 bg-brand-50'
                      : 'border-transparent hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0"><BranchIcon type={b.icon} size={14} /></div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${selectedId === b.id ? 'text-brand-700' : 'text-ink-700'}`}>
                        {b.label}
                      </p>
                      <p className="text-xs text-ink-400 leading-snug mt-0.5 line-clamp-2">{b.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-ink-100 space-y-2 shrink-0">
              <button
                onClick={() => selectedBranch && runBranch(selectedBranch)}
                disabled={isRunning || !selectedBranch}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
              >
                {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                Run selected branch
              </button>
              <button
                onClick={runAll}
                disabled={isRunning}
                className="w-full flex items-center justify-center gap-2 border border-ink-200 hover:bg-ink-50 disabled:opacity-50 text-ink-600 text-sm font-medium px-4 py-2 rounded-xl transition-all"
              >
                <List size={14} />
                Run all {branches.length} branches
              </button>
            </div>
          </div>

          {/* Right: Simulation log */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {selectedBranch && !showAllResults && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border mb-4 ${
                selectedBranch.type === 'complete'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <BranchIcon type={selectedBranch.icon} size={18} />
                <div>
                  <p className="text-sm font-bold text-ink-800">{selectedBranch.label}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{selectedBranch.description}</p>
                  {selectedBranch.triggerDesc && (
                    <p className="text-xs font-mono bg-white/70 rounded px-2 py-0.5 mt-1.5 inline-block text-ink-600 border border-black/10">
                      Trigger: {selectedBranch.triggerDesc}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!result && !isRunning && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <PlayCircle size={36} className="text-ink-200 mb-3" />
                <p className="text-sm font-semibold text-ink-500">Select a branch and click Run</p>
                <p className="text-xs text-ink-400 mt-1">The engine will auto-fill answers and walk through the survey</p>
              </div>
            )}

            {isRunning && (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 size={28} className="text-brand-400 animate-spin mb-3" />
                <p className="text-sm text-ink-500">Simulating survey flow…</p>
              </div>
            )}

            {!isRunning && showAllResults && result?.allResults && (
              <AllResultsTable results={result.allResults} />
            )}

            {!isRunning && result && !showAllResults && (
              <div>
                {result.outcome?.type === 'complete' && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">Outcome: Completed ✓</p>
                      <p className="text-xs text-emerald-600">Respondent reached the end of the survey.</p>
                    </div>
                  </div>
                )}
                {result.outcome?.type === 'terminated' && (
                  <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
                    <XCircle size={20} className="text-rose-500" />
                    <div>
                      <p className="text-sm font-bold text-rose-700">Outcome: Screen-out ✗</p>
                      <p className="text-xs text-rose-500 mt-0.5">{result.outcome.reason}</p>
                    </div>
                  </div>
                )}

                <div className="border border-ink-100 rounded-xl p-4 bg-ink-50/40">
                  <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-3">Step-by-step log</p>
                  {result.log?.map((entry, i) => (
                    <LogEntry key={i} entry={entry} />
                  ))}
                </div>

                <details className="mt-4">
                  <summary className="text-xs text-ink-400 cursor-pointer hover:text-ink-600 font-medium">
                    View all auto-generated answers ({Object.keys(result.responses || {}).length} questions)
                  </summary>
                  <div className="mt-2 text-xs font-mono bg-ink-900 text-ink-100 rounded-xl p-4 overflow-x-auto max-h-64 overflow-y-auto">
                    <pre>{JSON.stringify(result.responses, null, 2)}</pre>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SurveyTestRunner
