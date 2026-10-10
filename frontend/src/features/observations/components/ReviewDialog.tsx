import { useState, useEffect } from 'react'
import type { AnalystReviewState } from '../types'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui'
import { getApi } from '@/features/observations/api'
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'


export interface ReviewDialogProps {
  open: boolean
  onClose: () => void
  observationId: string
  detectionId?: string
  initialStatus?: AnalystReviewState
  initialNotes?: string
  onSaveSuccess?: () => void
}

export function ReviewDialog({
  open,
  onClose,
  observationId,
  detectionId,
  initialStatus = 'confirmed',
  initialNotes = '',
  onSaveSuccess,
}: ReviewDialogProps) {
  const [status, setStatus] = useState<AnalystReviewState>(initialStatus)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  const toast = useToast()

  useEffect(() => {
    if (open) {
      setStatus(initialStatus === 'unreviewed' ? 'confirmed' : initialStatus)
      setNotes(initialNotes || '')
    }
  }, [open, initialStatus, initialNotes])

  const handleSave = async () => {
    try {
      setSaving(true)
      const api = getApi()
      await api.saveReview({
        observationId,
        detectionId,
        status,
        notes: notes.trim() || undefined,
      })
      toast.show({ title: 'Analyst review decision saved.', tone: 'success' })
      onSaveSuccess?.()
      onClose()
    } catch (err: any) {
      toast.show({ title: err.message || 'Failed to save review decision', tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }


  const statusOptions = [
    {
      value: 'confirmed',
      label: (
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-success" />
          Confirmed
        </span>
      ),
    },
    {
      value: 'false_positive',
      label: (
        <span className="flex items-center gap-1.5">
          <XCircle className="size-3.5 text-danger" />
          False Positive
        </span>
      ),
    },
    {
      value: 'uncertain',
      label: (
        <span className="flex items-center gap-1.5">
          <HelpCircle className="size-3.5 text-warning" />
          Uncertain
        </span>
      ),
    },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={detectionId ? `Review Detection ${detectionId}` : `Review Observation ${observationId}`}
      description="Record analyst verification decision. Original model predictions are preserved separately."
    >
      <div className="space-y-4">
        <Field label="Review Status">
          {() => (
            <SegmentedControl
              label="Review Status"
              options={statusOptions}
              value={status}
              onChange={(val) => setStatus(val as AnalystReviewState)}
              className="w-full"
            />
          )}
        </Field>

        <Field label="Analyst Notes (Optional)" hint="Add rationale, environmental context, or imagery quality notes.">
          {({ id }) => (
            <textarea
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g., Confirmed plastic debris raft; matches Sentinel-2 RGB patch..."
              className="w-full rounded-md border border-hairline bg-white p-2 text-small text-ink focus:border-accent focus:outline-none"
            />
          )}
        </Field>


        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save Review
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
