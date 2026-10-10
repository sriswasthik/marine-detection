import { useState, useEffect } from 'react'
import { Plus, ShieldCheck, MapPin, Trash2, ExternalLink, Calendar, ChevronRight } from 'lucide-react'
import { PageContainer, PageHeader } from './PageHeader'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Tag } from '@/components/ui/Tag'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui'
import { getApi } from '@/features/observations/api'
import type { MonitoringArea, MonitoringAreaDetail } from '@/features/observations/types'
import { formatArea, formatDate } from '@/lib/format'
import { Link } from 'react-router-dom'

export function MonitoringAreasPage() {
  const toast = useToast()
  const [areas, setAreas] = useState<MonitoringArea[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedArea, setSelectedArea] = useState<MonitoringAreaDetail | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // Create Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [purpose, setPurpose] = useState('Surveillance')
  const [bboxCoords, setBboxCoords] = useState('-150.5, 25.5, -149.5, 26.5') // minLng, minLat, maxLng, maxLat
  const [creating, setCreating] = useState(false)

  const fetchAreas = async () => {
    try {
      setLoading(true)
      const api = getApi()
      const res = await api.listMonitoringAreas()
      setAreas(res.data)
    } catch (err: any) {
      toast.show({ title: 'Failed to load monitoring areas', tone: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchAreas()
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.show({ title: 'Area name is required', tone: 'warning' })
      return
    }
    const parts = bboxCoords.split(',').map((p) => parseFloat(p.trim()))
    if (parts.length !== 4 || parts.some(isNaN)) {
      toast.show({ title: 'Please enter valid coordinates: minLng, minLat, maxLng, maxLat', tone: 'warning' })
      return
    }

    const [w, s, e, n] = parts
    const geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [w, s],
          [e, s],
          [e, n],
          [w, n],
          [w, s],
        ],
      ],
    }

    try {
      setCreating(true)
      const api = getApi()
      await api.createMonitoringArea({
        name: name.trim(),
        description: description.trim() || undefined,
        purpose,
        geometry,
        crs: 'EPSG:4326',
      })
      toast.show({ title: `Monitoring area "${name}" created successfully`, tone: 'success' })
      setCreateOpen(false)
      setName('')
      setDescription('')
      void fetchAreas()
    } catch (err: any) {
      toast.show({ title: err.message || 'Failed to create monitoring area', tone: 'danger' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, areaName: string) => {
    if (!confirm(`Are you sure you want to delete monitoring area "${areaName}"?`)) return
    try {
      const api = getApi()
      await api.deleteMonitoringArea(id)
      toast.show({ title: 'Monitoring area deleted', tone: 'success' })
      if (selectedArea?.id === id) setSelectedArea(null)
      void fetchAreas()
    } catch (err: any) {
      toast.show({ title: 'Failed to delete monitoring area', tone: 'danger' })
    }
  }

  const handleSelectArea = async (id: string) => {
    try {
      const api = getApi()
      const res = await api.getMonitoringArea(id)
      setSelectedArea(res.data)
    } catch (err: any) {
      toast.show({ title: 'Failed to load area detail', tone: 'danger' })
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Monitoring Areas"
            description="Define areas of interest, track intersecting satellite acquisitions, and analyze debris history."
          />
          <Button
            variant="primary"
            iconStart={<Plus className="size-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Define New Area
          </Button>
        </div>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Area List Column */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-body font-medium text-ink flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent-ink" />
            Saved Monitoring Zones ({areas.length})
          </h2>

          {loading ? (
            <div className="p-4 text-small text-ink-2">Loading monitoring areas...</div>
          ) : areas.length === 0 ? (
            <EmptyState
              title="No monitoring areas defined"
              description="Define a spatial bounding polygon to track debris detections over time."
            />
          ) : (
            <div className="space-y-3">
              {areas.map((area) => {
                const isSelected = selectedArea?.id === area.id
                return (
                  <div
                    key={area.id}
                    onClick={() => void handleSelectArea(area.id)}
                    className={`group cursor-pointer rounded-panel border p-4 transition-all ${
                      isSelected
                        ? 'border-accent bg-accent-wash/30 shadow-sm'
                        : 'border-hairline bg-white hover:border-accent-ink/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-body font-semibold text-ink group-hover:text-accent-ink">
                          {area.name}
                        </h3>
                        {area.purpose ? (
                          <span className="text-mono text-tiny text-ink-2">{area.purpose}</span>
                        ) : null}
                      </div>
                      <Tag tone={area.status === 'active' ? 'success' : 'neutral'}>
                        {area.status}
                      </Tag>
                    </div>

                    {area.description ? (
                      <p className="mt-2 text-small text-ink-2 line-clamp-2">{area.description}</p>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between text-tiny text-ink-2 border-t border-hairline/50 pt-2">
                      <span className="font-mono">{formatArea(area.areaM2)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(area.id, area.name)
                          }}
                          className="text-ink-2 hover:text-danger"
                          title="Delete area"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                        <ChevronRight className="size-4 text-ink-2" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Area Detail Column */}
        <div className="lg:col-span-2">
          {selectedArea ? (
            <div className="rounded-panel border border-hairline bg-white p-6 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-title text-ink">{selectedArea.name}</h2>
                    <Tag tone="accent">{selectedArea.crs}</Tag>
                  </div>
                  {selectedArea.description ? (
                    <p className="mt-1 text-small text-ink-2">{selectedArea.description}</p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedArea(null)}
                >
                  Close Detail
                </Button>
              </div>

              {/* Spatial Bounds Summary */}
              <div className="grid grid-cols-2 gap-4 rounded-md bg-rule-light p-4 text-small">
                <div>
                  <span className="text-tiny font-medium text-ink-2 block">TOTAL AREA</span>
                  <span className="font-mono text-body font-semibold text-ink">
                    {formatArea(selectedArea.areaM2)}
                  </span>
                </div>
                <div>
                  <span className="text-tiny font-medium text-ink-2 block">GEOMETRY TYPE</span>
                  <span className="font-mono text-body text-ink">
                    {selectedArea.geometry.type}
                  </span>
                </div>
              </div>

              {/* Intersecting Observations Timeline */}
              <div>
                <h3 className="text-body font-medium text-ink mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-accent" />
                  Intersecting Observations History
                </h3>

                {selectedArea.intersectingObservations.length === 0 ? (
                  <p className="text-small text-ink-2 italic bg-hairline/20 p-4 rounded-md">
                    No satellite observations currently intersect this defined monitoring area boundary.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedArea.intersectingObservations.map((obs) => (
                      <div
                        key={obs.observationId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-hairline p-3 hover:bg-rule-light/40"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-small text-ink">{obs.region}</span>
                            <span className="text-tiny text-ink-2 font-mono">
                              ({obs.observationId})
                            </span>
                          </div>
                          <div className="text-tiny text-ink-2 mt-0.5">
                            Captured: {formatDate(obs.capturedAt)}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-small">
                          <div>
                            <span className="text-tiny text-ink-2 block">Debris in AOI</span>
                            <span className="font-mono font-medium text-ink">
                              {formatArea(obs.debrisAreaM2InArea)}
                            </span>
                          </div>
                          <Link
                            to={`/observations/${obs.observationId}`}
                            className="inline-flex items-center gap-1 text-accent-ink font-medium hover:underline text-small"
                          >
                            View Evidence
                            <ExternalLink className="size-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-panel border border-dashed border-hairline p-12 text-center">
              <MapPin className="mx-auto size-8 text-ink-2 mb-2" />
              <h3 className="text-body font-medium text-ink">Select a Monitoring Area</h3>
              <p className="text-small text-ink-2 mt-1">
                Click any zone from the list to view its spatial bounds and intersecting observations timeline.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Define Monitoring Area"
        description="Enter spatial boundary polygon coordinates (WGS84) to register a new area of interest."
      >
        <div className="space-y-4">
          <Field label="Area Name">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., North Pacific Gyre Sector Alpha"
                className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              />
            )}
          </Field>

          <Field label="Description (Optional)">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Target sector for high plastic accumulation watch"
                className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              />
            )}
          </Field>

          <Field label="Purpose">
            {({ id }) => (
              <select
                id={id}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              >
                <option value="Surveillance">Surveillance</option>
                <option value="Environmental Study">Environmental Study</option>
                <option value="Clean-up Reconnaissance">Clean-up Reconnaissance</option>
              </select>
            )}
          </Field>

          <Field
            label="Bounding Box Coordinates (WGS84)"
            hint="Format: minLongitude, minLatitude, maxLongitude, maxLatitude"
          >
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={bboxCoords}
                onChange={(e) => setBboxCoords(e.target.value)}
                placeholder="-150.5, 25.5, -149.5, 26.5"
                className="w-full font-mono rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
              />
            )}
          </Field>


          <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={creating}>
              Save Area
            </Button>
          </div>
        </div>
      </Dialog>
      </div>
    </PageContainer>
  )
}

