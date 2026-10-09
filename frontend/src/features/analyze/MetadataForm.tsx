import { useState } from 'react'
import { Button, TextInput } from '@/components/ui'
import type { AnalyzeDraft } from './draft'
import { useAnalyzeDraft } from './draftContext'
import type { BoundsInput, BoundsValidation } from './validate'
import { useFormat } from '@/features/settings/settingsContext'

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
        <span className="font-normal text-ink-2">
          {required ? '(required for this file)' : '(optional)'}
        </span>
      </legend>
      <p className="text-small text-ink-2">
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

/** Region, capture time and, when the file cannot place itself, its bounds. The source is fixed. */
export function MetadataForm({
  draft,
  boundsValidation,
  boundsRequired,
  boundsHidden = false,
}: {
  draft: AnalyzeDraft
  boundsValidation: BoundsValidation
  /** The file has no usable embedded georeferencing. */
  boundsRequired: boolean
  /** The file is refused for its format, so bounds would be wasted effort. */
  boundsHidden?: boolean
}) {
  const fmt = useFormat()
  const { dispatch } = useAnalyzeDraft()
  const [editBounds, setEditBounds] = useState(false)
  const embedded = !boundsRequired && draft.boundsOrigin === 'file' ? boundsValidation.bounds : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-small font-medium text-ink">Source</span>
        <span className="text-small text-ink">Satellite (Sentinel-2)</span>
        <span className="text-small text-ink-2">
          The current model reads 11-band Sentinel-2 images only. Drone imagery is not supported.
        </span>
      </div>

      <TextInput
        label={
          <>
            Region name <span className="font-normal text-ink-2">(optional)</span>
          </>
        }
        placeholder="For example: Ennore coast, Bay of Bengal"
        value={draft.region}
        onChange={(e) => dispatch({ type: 'regionChanged', region: e.target.value })}
        hint={
          draft.regionHint
            ? `${draft.regionHint}. Left empty, the result is named after its location.`
            : 'Shown on the map and in reports. Left empty, the result is named after its location.'
        }
      />

      <TextInput
        label="Captured at"
        type="datetime-local"
        value={draft.capturedAt}
        onChange={(e) => dispatch({ type: 'capturedAtChanged', capturedAt: e.target.value })}
        hint="When the image was taken, in your local time."
      />

      {draft.file && !boundsHidden ? (
        embedded && !editBounds ? (
          <div className="flex flex-col gap-2">
            <span className="text-small font-medium text-ink">Geographic bounds</span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="data text-ink-2">
                {fmt.coordinates({ lat: embedded.north, lng: embedded.east }, { digits: 4 })} to{' '}
                {fmt.coordinates({ lat: embedded.south, lng: embedded.west }, { digits: 4 })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditBounds(true)}>
                Edit
              </Button>
            </div>
            <p className="text-small text-ink-2">
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
