import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NextStep } from '@/app/shell/NextStep'
import { useClaimPrimaryAction } from '@/app/shell/primaryAction'
import { Banner, Button, buttonStyles, useToast } from '@/components/ui'
import { DemoScenarioSelect } from '@/features/analyze/DemoScenarioSelect'
import { useAnalyzeDraft } from '@/features/analyze/draftContext'
import { FilePanel } from '@/features/analyze/FilePanel'
import { inspectFile } from '@/features/analyze/inspectFile'
import { MetadataForm } from '@/features/analyze/MetadataForm'
import { ProcessingStepper } from '@/features/analyze/ProcessingStepper'
import { QualityCheck } from '@/features/analyze/QualityCheck'
import { AnalysisReport } from '@/features/analyze/report/AnalysisReport'
import { ImageFactsSection } from '@/features/analyze/report/ImageFactsSection'
import { FailurePanel, SuccessPanel } from '@/features/analyze/RunOutcome'
import { stepStatuses } from '@/features/analyze/runReducer'
import { SampleScenes } from '@/features/analyze/SampleScenes'
import { sampleScenes, sampleSelection } from '@/features/analyze/samples'
import { UploadDropzone } from '@/features/analyze/UploadDropzone'
import { useAnalysisRun } from '@/features/analyze/useAnalysisRun'
import { SpectralStack } from '@/features/scene3d/SpectralStack'
import { useElapsed } from '@/features/analyze/useElapsed'
import { fileKind, qualityChecks, runReadiness, validateBounds } from '@/features/analyze/validate'
import type { Observation } from '@/features/observations/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/features/settings/settingsContext'
import { imageFactsFromHeader } from '@/lib/analysisReport'
import { fromDateTimeLocalValue } from '@/lib/datetime'
import { PageContainer, PageHeader } from './PageHeader'

/**
 * Analyze: choose an image (or a sample scene), check it, add its details, then watch it go
 * through Upload, Preprocess, Detect and Map, and read the analysis report it produced. The draft
 * survives navigation and retries.
 */
export function AnalyzePage() {
  useDocumentTitle('Analyze new imagery')
  // The page owns the primary action: Run detection, then Open on the map.
  useClaimPrimaryAction(true)
  const { draft, dispatch } = useAnalyzeDraft()
  const { state: run, start, cancel, reset } = useAnalysisRun()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const scenes = useMemo(() => sampleScenes(), [])
  const online = useOnlineStatus()
  const sampleData = useSettings().dataSource === 'mock'

  const file = draft.file
  const boundsValidation = useMemo(() => validateBounds(draft.bounds), [draft.bounds])
  /** A file of the wrong format is refused outright, so its bounds are not asked for. */
  const unsupported = file !== null && fileKind(file.facts) === null
  const boundsRequired = Boolean(
    file && !unsupported && !file.inspecting && !file.inspection?.embeddedBounds,
  )
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
    // Sample scenes exist only on sample data; the live service analyses real files only.
    const hero = sampleData ? scenes[0] : undefined
    if (hero && !draft.file) dispatch({ type: 'sampleSelected', sample: sampleSelection(hero) })
    setSearchParams({}, { replace: true })
  }, [wantsSample, sampleData, scenes, draft.file, dispatch, setSearchParams])

  const elapsed = useElapsed(
    run.phase === 'idle' ? null : run.startedAt,
    run.phase === 'running' || run.phase === 'idle' ? null : run.finishedAt,
  )

  const invalidFailure =
    run.phase === 'failed' && run.failure.kind === 'invalid' ? run.failure : null
  const showForm = run.phase === 'idle' || invalidFailure !== null

  // The form is long (on phones Run detection sits low on it); the run and its report start at the
  // top of the page, not wherever the form was scrolled to.
  useEffect(() => {
    if (!showForm) window.scrollTo({ top: 0 })
  }, [showForm])

  return (
    <PageContainer>
      <div className="flex flex-col gap-10">
        <PageHeader
          title="Analyze new imagery"
          description="Add an 11-band Sentinel-2 image. The model finds possible floating debris, measures it and places it on the map."
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
                    {/* Only facts actually read from the header; an unreadable file has none. */}
                    {file.kind === 'upload' &&
                    !unsupported &&
                    file.inspection &&
                    !file.inspection.readError ? (
                      <ImageFactsSection
                        facts={imageFactsFromHeader(file.inspection)}
                        source="Read from the file header in this browser. The service checks the file again after upload."
                      />
                    ) : null}
                    <QualityCheck checks={checks} />
                  </>
                ) : (
                  <>
                    <UploadDropzone onFile={chooseFile} />
                    {sampleData && scenes[0] ? (
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2">
                        No Sentinel-2 file at hand?
                        <button
                          type="button"
                          onClick={() => scenes[0] && chooseSample(scenes[0])}
                          className={buttonStyles({ variant: 'tertiary', size: 'sm' })}
                        >
                          Load a sample scene
                        </button>
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-6">
                <MetadataForm
                  draft={draft}
                  boundsValidation={boundsValidation}
                  boundsRequired={boundsRequired}
                  boundsHidden={unsupported}
                />
                {/* Phones: the one primary action stays in view, above the tab bar. */}
                <div className="flex flex-col gap-2 border-t border-hairline pt-5 max-lg:sticky max-lg:bottom-[var(--tabbar-offset)] max-lg:z-10 max-lg:bg-paper max-lg:pb-4">
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
                    <p id="run-reason" className="text-small text-ink-2">
                      {readiness.reason}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {sampleData ? (
              <SampleScenes
                scenes={scenes}
                selectedId={file?.kind === 'sample' ? file.sampleId : null}
                onSelect={chooseSample}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-16">
            <div className="flex w-full flex-col gap-6">
              {file ? (
                <p className="text-small text-ink-2">
                  <span className="font-medium text-ink">{file.facts.name}</span>
                  {draft.region.trim() ? ` · ${draft.region.trim()}` : null}
                </p>
              ) : null}
              <div className="grid gap-8 border-y border-ink py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <SpectralStack
                  statuses={stepStatuses(run)}
                  uploadPercent={run.phase === 'running' ? run.uploadPercent : null}
                  className="max-lg:order-last"
                />
                <div className="flex min-w-0 flex-col">
                  {/* After success the outcome leads, so its action is on the first screen. */}
                  {run.phase === 'succeeded' ? (
                    <div className="mb-6">
                      <SuccessPanel
                        summary={run.summary}
                        onViewResults={openResults}
                        onAnalyzeAnother={() => {
                          reset()
                          dispatch({ type: 'reset', now: new Date() })
                        }}
                      />
                    </div>
                  ) : null}
                  <ProcessingStepper
                    statuses={stepStatuses(run)}
                    uploadPercent={run.phase === 'running' ? run.uploadPercent : null}
                    elapsedMs={elapsed}
                    onCancel={run.phase === 'running' ? cancelRun : undefined}
                    failureNote={run.phase === 'failed' ? 'Stopped at this step' : undefined}
                  />
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
            </div>
            {observationId ? <AnalysisReport observationId={observationId} /> : null}
          </div>
        )}

        <NextStep page="analyze" observationId={observationId} />
        {sampleData ? (
          <footer className="border-t border-hairline pt-4">
            <DemoScenarioSelect />
          </footer>
        ) : null}
      </div>
    </PageContainer>
  )
}
