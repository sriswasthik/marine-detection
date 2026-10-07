import { useState } from 'react'
import { Button, SegmentedControl, TextInput } from '@/components/ui'
import type { ObservationSource } from '@/features/observations/types'
import type { AnalyzeDraft } from './draft'
import { useAnalyzeDraft } from './draftContext'
import type { BoundsInput, BoundsValidation } from './validate'
import { useFormat } from '@/features/settings/settingsContext'

const SOURCE_OPTIONS: { value: ObservationSource; label: string }[] = [
  { value: 'satellite', label: 'Satellite (Sentinel-2)' },
  { value: 'drone', label: 'Drone' },
]

const BOUND_FIELDS: { key: keyof BoundsInput; label: string; placeholder: string }[] = [
  { key: 'north', label: 'North', placeholder: '13.2430' },
  { key: 'south', label: 'South', placeholder: '13.1970' },
  { key: 'east', label: 'East', placeholder: '80.3960' },
  { key: 'west', label: 'West', placeholder: '80.3400' },
]

function BoundsFields({
  draft,
  validation,
  required,
}: {
  draft: AnalyzeDraft
  validation: BoundsValidation
  required: boolean
}) {
  const { dispatch } = useAnalyzeDraft()
  const [touched, setTouched] = useState<Partial<Record<keyof BoundsInput, boolean>>>({})
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-small font-medium text-ink">
        Geographic bounds{' '}
        <span className="font-normal text-ink-muted">
          {required ? '(required for this file)' : '(optional)'}
        </span>
      </legend>
      <p className="text-caption text-ink-muted">
        Decimal degrees of the image edges. North and south are latitudes, east and west are
        longitudes.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {BOUND_FIELDS.map(({ key, label, placeholder }) => (
          <TextInput
            key={key}
            label={label}
            inputMode="decimal"
            numeric
            placeholder={placeholder}
            value={draft.bounds[key]}
            onChange={(e) => dispatch({ type: 'boundsChanged', field: key, value: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
            error={touched[key] || draft.bounds[key] ? validation.errors[key] : undefined}
          />
        ))}
      </div>
    </fieldset>
  )
}

/** Source, region, capture time and, when the file cannot place itself, its bounds. */
export function MetadataForm({
  draft,
  boundsValidation,
  boundsRequired,
}: {
  draft: AnalyzeDraft
  boundsValidation: BoundsValidation
  /** The file has no usable embedded georeferencing. */
  boundsRequired: boolean
}) {
  const fmt = useFormat()
  const { dispatch } = useAnalyzeDraft()
  const [editBounds, setEditBounds] = useState(false)
  const embedded = !boundsRequired && draft.boundsOrigin === 'file' ? boundsValidation.bounds : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span id="source-label" className="text-small font-medium text-ink">
          Source
        </span>
        <SegmentedControl
          label="Source"
          value={draft.source}
          onChange={(source) => dispatch({ type: 'sourceChanged', source })}
          options={SOURCE_OPTIONS}
          className="self-start"
        />
      </div>

      <TextInput
        label="Region name"
        placeholder="For example: Ennore coast, Bay of Bengal"
        value={draft.region}
        onChange={(e) => dispatch({ type: 'regionChanged', region: e.target.value })}
        hint={draft.regionHint ?? 'Shown on the map and in reports.'}
      />

      <TextInput
        label="Captured at"
        type="datetime-local"
        value={draft.capturedAt}
        onChange={(e) => dispatch({ type: 'capturedAtChanged', capturedAt: e.target.value })}
        hint="When the image was taken, in your local time."
      />

      {draft.file ? (
        embedded && !editBounds ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-ink">Geographic bounds</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="mono-label text-ink-muted">
                {fmt.coordinates({ lat: embedded.north, lng: embedded.east }, { digits: 4 })} to{' '}
                {fmt.coordinates({ lat: embedded.south, lng: embedded.west }, { digits: 4 })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditBounds(true)}>
                Edit
              </Button>
            </div>
            <p className="text-caption text-ink-muted">
              {draft.file.kind === 'sample' ? 'From the sample scene.' : 'Read from the file.'}
            </p>
          </div>
        ) : (
          <BoundsFields draft={draft} validation={boundsValidation} required={boundsRequired} />
        )
      ) : null}
    </div>
  )
}
