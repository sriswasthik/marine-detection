import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banner, Button, useToast } from '@/components/ui'
import { DemoScenarioSelect } from '@/features/analyze/DemoScenarioSelect'
import { useAnalyzeDraft } from '@/features/analyze/draftContext'
import { FilePanel } from '@/features/analyze/FilePanel'
import { inspectFile } from '@/features/analyze/inspectFile'
import { MetadataForm } from '@/features/analyze/MetadataForm'
import { ProcessingStepper } from '@/features/analyze/ProcessingStepper'
import { QualityCheck } from '@/features/analyze/QualityCheck'
import { FailurePanel, SuccessPanel } from '@/features/analyze/RunOutcome'
import { stepStatuses } from '@/features/analyze/runReducer'
import { SampleScenes } from '@/features/analyze/SampleScenes'
import { sampleScenes, sampleSelection } from '@/features/analyze/samples'
import { UploadDropzone } from '@/features/analyze/UploadDropzone'
import { useAnalysisRun } from '@/features/analyze/useAnalysisRun'
import { useElapsed } from '@/features/analyze/useElapsed'
import { qualityChecks, runReadiness, validateBounds } from '@/features/analyze/validate'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { RESULT_AUTO_OPEN_MS } from '@/lib/config'
import { fromDateTimeLocalValue } from '@/lib/datetime'
import { ENV } from '@/lib/env'
import { PageContainer, PageHeader } from './PageHeader'

/**
 * Analyze: choose an image (or a sample scene), check it, add its details, then watch it go
 * through Upload, Preprocess, Detect and Map. The draft survives navigation and retries.
 */
export function AnalyzePage() {
  useDocumentTitle('Analyze new imagery')
  const { draft, dispatch } = useAnalyzeDraft()
  const { state: run, start, cancel, reset } = useAnalysisRun()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [autoOpenCancelled, setAutoOpenCancelled] = useState(false)
  const scenes = useMemo(() => sampleScenes(), [])
  const online = useOnlineStatus()

  const file = draft.file
  const boundsValidation = useMemo(() => validateBounds(draft.bounds), [draft.bounds])
  const boundsRequired = Boolean(file && !file.inspecting && !file.inspection?.embeddedBounds)
  const checks = useMemo(
    () =>
      file
        ? qualityChecks({
            facts: file.facts,
            inspection: file.inspection,
            inspecting: file.inspecting,
            bounds: boundsValidation,
          })
        : [],
    [file, boundsValidation],
  )
  const capturedAtIso = fromDateTimeLocalValue(draft.capturedAt)
  const readiness = runReadiness({
    hasFile: file !== null,
    inspecting: file?.inspecting ?? false,
    checks,
    region: draft.region,
    capturedAtIso,
    online,
  })

  const chooseFile = (chosen: File) => {
    dispatch({
      type: 'fileSelected',
      file: chosen,
      facts: { name: chosen.name, size: chosen.size, type: chosen.type },
    })
    void inspectFile(chosen).then(({ inspection, regionHint }) =>
      dispatch({ type: 'inspected', file: chosen, inspection, regionHint }),
    )
  }

  const chooseSample = (observation: Observation) =>
    dispatch({ type: 'sampleSelected', sample: sampleSelection(observation) })

  const runDetection = () => {
    if (!file || !readiness.ready || !capturedAtIso) return
    setAutoOpenCancelled(false)
    void start({
      file: file.file,
      source: draft.source,
      region: draft.region.trim(),
      capturedAt: capturedAtIso,
      bounds: boundsValidation.bounds ?? undefined,
    })
  }

  const chooseAnotherFile = () => {
    reset()
    dispatch({ type: 'fileCleared' })
  }

  const cancelRun = () => {
    cancel()
    toast.show({ title: 'Analysis cancelled', description: 'Your file and details are kept.' })
  }

  const observationId = run.phase === 'succeeded' ? run.observationId : null
  const openResults = () => {
    if (!observationId) return
    navigate(`/map/${encodeURIComponent(observationId)}?fresh=1`)
    reset()
    dispatch({ type: 'reset', now: new Date() })
  }

  // Overview's "Load a sample scene" arrives with ?sample=1: start from the hero sample.
  const wantsSample = searchParams.has('sample')
  useEffect(() => {
    if (!wantsSample) return
    const hero = scenes[0]
    if (hero && !draft.file) dispatch({ type: 'sampleSelected', sample: sampleSelection(hero) })
    setSearchParams({}, { replace: true })
  }, [wantsSample, scenes, draft.file, dispatch, setSearchParams])

  // After success, open the map on its own unless the user does something first.
  const autoOpening = observationId !== null && !autoOpenCancelled
  useEffect(() => {
    if (!autoOpening || !observationId) return
    const stop = () => setAutoOpenCancelled(true)
    window.addEventListener('pointerdown', stop, { once: true })
    window.addEventListener('keydown', stop, { once: true })
    const timer = window.setTimeout(() => {
      navigate(`/map/${encodeURIComponent(observationId)}?fresh=1`)
      reset()
      dispatch({ type: 'reset', now: new Date() })
    }, RESULT_AUTO_OPEN_MS)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [autoOpening, observationId, navigate, reset, dispatch])

  const elapsed = useElapsed(
    run.phase === 'idle' ? null : run.startedAt,
    run.phase === 'running' || run.phase === 'idle' ? null : run.finishedAt,
  )

  const invalidFailure =
    run.phase === 'failed' && run.failure.kind === 'invalid' ? run.failure : null
  const showForm = run.phase === 'idle' || invalidFailure !== null

  return (
    <PageContainer>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="Analyze new imagery"
          description="Add a satellite or drone image. The model finds floating debris, measures it and places it on the map."
        />

        {showForm ? (
          <>
            {invalidFailure ? (
              <Banner
                tone="danger"
                title={invalidFailure.title}
                action={
                  <Button variant="secondary" size="sm" onClick={chooseAnotherFile}>
                    Choose another file
                  </Button>
                }
              >
                {invalidFailure.message}
              </Banner>
            ) : null}

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-6">
                {file ? (
                  <>
                    <FilePanel draftFile={file} onReplace={chooseAnotherFile} />
                    <QualityCheck checks={checks} />
                  </>
                ) : (
                  <UploadDropzone onFile={chooseFile} />
                )}
              </div>

              <div className="flex flex-col gap-6">
                <MetadataForm
                  draft={draft}
                  boundsValidation={boundsValidation}
                  boundsRequired={boundsRequired}
                />
                <div className="flex flex-col gap-2 border-t border-border pt-5">
                  <Button
                    variant="primary"
                    onClick={runDetection}
                    disabled={!readiness.ready}
                    aria-describedby={readiness.reason ? 'run-reason' : undefined}
                    className="self-start"
                  >
                    Run detection
                  </Button>
                  {readiness.reason ? (
                    <p id="run-reason" className="text-small text-ink-muted">
                      {readiness.reason}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <SampleScenes
              scenes={scenes}
              selectedId={file?.kind === 'sample' ? file.sampleId : null}
              onSelect={chooseSample}
            />
          </>
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
            {file ? (
              <p className="text-small text-ink-muted">
                <span className="font-medium text-ink">{file.facts.name}</span> ·{' '}
                {draft.region.trim()}
              </p>
            ) : null}
            <div className="rounded-card border border-border bg-surface p-6 shadow-subtle">
              <ProcessingStepper
                statuses={stepStatuses(run)}
                uploadPercent={run.phase === 'running' ? run.uploadPercent : null}
                elapsedMs={elapsed}
                onCancel={run.phase === 'running' ? cancelRun : undefined}
                failureNote={run.phase === 'failed' ? 'Stopped at this step' : undefined}
              />
              {run.phase === 'succeeded' ? (
                <div className="mt-6">
                  <SuccessPanel
                    summary={run.summary}
                    autoOpening={autoOpening}
                    onViewResults={openResults}
                    onAnalyzeAnother={() => {
                      reset()
                      dispatch({ type: 'reset', now: new Date() })
                    }}
                  />
                </div>
              ) : null}
              {run.phase === 'failed' && run.failure.kind !== 'invalid' ? (
                <div className="mt-6">
                  <FailurePanel
                    failure={run.failure}
                    onRetry={runDetection}
                    onEdit={reset}
                    retryBlockedReason={readiness.ready ? null : readiness.reason}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {ENV.useMock ? (
          <footer className="border-t border-border pt-4">
            <DemoScenarioSelect />
          </footer>
        ) : null}
      </div>
    </PageContainer>
  )
}
