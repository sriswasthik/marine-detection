import { useState, useEffect, useMemo } from 'react'
import { GitCompare, AlertTriangle, CheckCircle2, Download, Printer } from 'lucide-react'
import { PageContainer, PageHeader } from './PageHeader'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Tag'
import { useToast } from '@/components/ui'
import { getApi } from '@/features/observations/api'
import type { ObservationSummary, TemporalComparisonResult } from '@/features/observations/types'
import { formatArea, formatDate } from '@/lib/format'

export function ComparePage() {
  const toast = useToast()
  const [observations, setObservations] = useState<ObservationSummary[]>([])
  const [baselineId, setBaselineId] = useState<string>('')
  const [comparisonId, setComparisonId] = useState<string>('')
  const [loadingList, setLoadingList] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [result, setResult] = useState<TemporalComparisonResult | null>(null)

  useEffect(() => {
    async function loadObs() {
      try {
        setLoadingList(true)
        const api = getApi()
        const res = await api.listObservations()
        setObservations(res.data)
        if (res.data.length >= 2) {
          setBaselineId(res.data[0]?.id ?? '')
          setComparisonId(res.data[1]?.id ?? '')
        } else if (res.data.length === 1) {
          setBaselineId(res.data[0]?.id ?? '')
        }

      } catch (err) {
        toast.show({ title: 'Failed to load observation list', tone: 'danger' })
      } finally {
        setLoadingList(false)
      }
    }
    void loadObs()
  }, [])

  const handleRunComparison = async () => {
    if (!baselineId || !comparisonId) {
      toast.show({ title: 'Please select both a baseline and a comparison observation.', tone: 'warning' })
      return
    }
    if (baselineId === comparisonId) {
      toast.show({ title: 'Baseline and comparison observations must be different.', tone: 'warning' })
      return
    }

    try {
      setComparing(true)
      const api = getApi()
      const res = await api.compareObservations({
        baselineObservationId: baselineId,
        comparisonObservationId: comparisonId,
      })
      setResult(res)
      toast.show({ title: 'Temporal comparison completed', tone: 'success' })
    } catch (err: any) {
      toast.show({ title: err.message || 'Comparison calculation failed', tone: 'danger' })
    } finally {
      setComparing(false)
    }
  }

  const baselineObs = useMemo(
    () => observations.find((o) => o.id === baselineId),
    [observations, baselineId],
  )
  const comparisonObs = useMemo(
    () => observations.find((o) => o.id === comparisonId),
    [observations, comparisonId],
  )

  const handleExportCSV = () => {
    if (!result || !baselineObs || !comparisonObs) return
    const csvContent = [
      'Field,Baseline,Comparison,Difference',
      `ID,${baselineObs.id},${comparisonObs.id},-`,
      `Region,${baselineObs.region},${comparisonObs.region},-`,
      `CapturedAt,${baselineObs.capturedAt},${comparisonObs.capturedAt},-`,
      `DebrisAreaM2,${result.baselineDebrisAreaM2},${result.comparisonDebrisAreaM2},${result.areaDifferenceM2}`,
      `PercentChange,${result.percentChange !== null ? result.percentChange + '%' : 'N/A'},-,-`,
      `Detections,${result.baselineDetectionCount},${result.comparisonDetectionCount},${result.comparisonDetectionCount - result.baselineDetectionCount}`,
      `Hotspots,${result.baselineHotspotCount},${result.comparisonHotspotCount},${result.comparisonHotspotCount - result.baselineHotspotCount}`,
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `temporal_comparison_${baselineObs.id}_vs_${comparisonObs.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Temporal Comparison"
            description="Compare two satellite scenes of the same region to quantify marine debris area changes over time."
          />
          {result ? (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                iconStart={<Download className="size-4" />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconStart={<Printer className="size-4" />}
                onClick={() => window.print()}
              >
                Print Report
              </Button>
            </div>
          ) : null}
        </div>


      {/* Observation Selectors */}
      <div className="rounded-panel border border-hairline bg-white p-6 mb-6">
        <h2 className="text-body font-semibold text-ink mb-4 flex items-center gap-2">
          <GitCompare className="size-4 text-accent-ink" />
          Select Scenes to Compare
        </h2>

        {loadingList ? (
          <div className="text-small text-ink-2">Loading observations...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-small font-medium text-ink block mb-1">
                Baseline Scene (T1)
              </label>
              <select
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Select baseline observation...</option>
                {observations.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === comparisonId}>
                    {o.region} ({o.id}) - {formatDate(o.capturedAt)}
                  </option>
                ))}
              </select>
              {baselineObs ? (
                <div className="mt-2 text-tiny text-ink-2 space-y-0.5">
                  <div>
                    Captured: <span className="font-mono">{formatDate(baselineObs.capturedAt)}</span>
                  </div>
                  <div>
                    Debris Area:{' '}
                    <span className="font-mono font-medium">{formatArea(baselineObs.debrisAreaM2)}</span>

                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-small font-medium text-ink block mb-1">
                Comparison Scene (T2)
              </label>
              <select
                value={comparisonId}
                onChange={(e) => setComparisonId(e.target.value)}
                className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Select comparison observation...</option>
                {observations.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.id === baselineId}>
                    {o.region} ({o.id}) - {formatDate(o.capturedAt)}
                  </option>
                ))}
              </select>
              {comparisonObs ? (
                <div className="mt-2 text-tiny text-ink-2 space-y-0.5">
                  <div>
                    Captured: <span className="font-mono">{formatDate(comparisonObs.capturedAt)}</span>
                  </div>
                  <div>
                    Debris Area:{' '}
                    <span className="font-mono font-medium">{formatArea(comparisonObs.debrisAreaM2)}</span>

                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            onClick={handleRunComparison}
            loading={comparing}
            disabled={!baselineId || !comparisonId || baselineId === comparisonId}
          >
            Calculate Differences
          </Button>
        </div>
      </div>

      {/* Comparison Results Section */}
      {result ? (
        <div className="space-y-6">
          {/* Comparability Banner */}
          <div
            className={`rounded-panel border p-4 flex items-start gap-3 ${
              result.comparability.status === 'directly_comparable'
                ? 'border-success-soft bg-success-soft/20'
                : result.comparability.status === 'comparable_with_warnings'
                ? 'border-warning-soft bg-warning-soft/20'
                : 'border-danger-soft bg-danger-soft/20'
            }`}
          >
            {result.comparability.status === 'directly_comparable' ? (
              <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-small text-ink">
                  Comparability Status:
                </span>
                <Tag
                  tone={
                    result.comparability.status === 'directly_comparable'
                      ? 'success'
                      : result.comparability.status === 'comparable_with_warnings'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {result.comparability.status.replace(/_/g, ' ')}
                </Tag>
              </div>
              {result.comparability.warnings.length > 0 ? (
                <ul className="mt-2 text-tiny text-ink-2 list-disc list-inside space-y-1">
                  {result.comparability.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-tiny text-ink-2">
                  Both scenes share compatible CRS, spatial extent, and acquisition parameters.
                </p>
              )}
            </div>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-panel border border-hairline bg-white p-4">
              <span className="text-tiny font-medium text-ink-2 block">BASELINE DEBRIS AREA</span>
              <span className="font-mono text-title font-semibold text-ink">
                {formatArea(result.baselineDebrisAreaM2)}
              </span>
              <span className="text-tiny text-ink-2 block mt-1">Scene T1</span>
            </div>

            <div className="rounded-panel border border-hairline bg-white p-4">
              <span className="text-tiny font-medium text-ink-2 block">COMPARISON DEBRIS AREA</span>
              <span className="font-mono text-title font-semibold text-ink">
                {formatArea(result.comparisonDebrisAreaM2)}
              </span>
              <span className="text-tiny text-ink-2 block mt-1">Scene T2</span>
            </div>

            <div className="rounded-panel border border-hairline bg-white p-4">
              <span className="text-tiny font-medium text-ink-2 block">AREA DIFFERENCE (Δm²)</span>
              <span
                className={`font-mono text-title font-semibold ${
                  result.areaDifferenceM2 > 0
                    ? 'text-danger'
                    : result.areaDifferenceM2 < 0
                    ? 'text-success'
                    : 'text-ink'
                }`}
              >
                {result.areaDifferenceM2 > 0 ? '+' : ''}
                {formatArea(result.areaDifferenceM2)}
              </span>
              <span className="text-tiny text-ink-2 block mt-1">Absolute change</span>
            </div>


            <div className="rounded-panel border border-hairline bg-white p-4">
              <span className="text-tiny font-medium text-ink-2 block">PERCENT CHANGE</span>
              <span className="font-mono text-title font-semibold text-ink">
                {result.percentChange !== null
                  ? `${result.percentChange > 0 ? '+' : ''}${result.percentChange.toFixed(1)}%`
                  : 'N/A (Baseline area is 0)'}
              </span>
              <span className="text-tiny text-ink-2 block mt-1">Relative variation</span>
            </div>
          </div>

          {/* Spatial Match Results Ledger */}
          <div className="rounded-panel border border-hairline bg-white p-6">
            <h3 className="text-body font-semibold text-ink mb-4">
              Spatial Detection Matches ({result.spatialMatches.length})
            </h3>
            {result.spatialMatches.length === 0 ? (
              <p className="text-small text-ink-2 italic">No matching spatial detections between scenes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-small">
                  <thead>
                    <tr className="border-b border-hairline text-tiny font-medium text-ink-2">
                      <th className="pb-2">MATCH TYPE</th>
                      <th className="pb-2">BASELINE DETECTION</th>
                      <th className="pb-2">COMPARISON DETECTION</th>
                      <th className="pb-2 text-right">INTERSECTION OVER UNION (IoU)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline/60">
                    {result.spatialMatches.map((m, idx) => (
                      <tr key={idx} className="hover:bg-rule-light/30">
                        <td className="py-2.5">
                          <Tag
                            tone={
                              m.matchType === 'overlapping'
                                ? 'accent'
                                : m.matchType === 'newly_detected'
                                ? 'warning'
                                : m.matchType === 'not_detected_in_later'
                                ? 'neutral'
                                : 'danger'
                            }
                          >
                            {m.matchType.replace(/_/g, ' ')}
                          </Tag>
                        </td>
                        <td className="py-2.5 font-mono text-tiny text-ink">
                          {m.baselineDetectionId || '—'}
                        </td>
                        <td className="py-2.5 font-mono text-tiny text-ink">
                          {m.comparisonDetectionId || '—'}
                        </td>
                        <td className="py-2.5 font-mono text-small text-ink text-right">
                          {(m.iou * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>
    </PageContainer>
  )
}

