import { useParams } from 'react-router-dom'
import { PageContainer, PageHeader } from './PageHeader'

export function ObservationDetailPage() {
  const { id } = useParams()
  return (
    <PageContainer>
      <PageHeader
        title="Observation"
        meta={id}
        description="Detections, measurements and evidence for this observation."
      />
    </PageContainer>
  )
}
