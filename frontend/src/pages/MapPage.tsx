import { useParams } from 'react-router-dom'
import { PageContainer, PageHeader } from './PageHeader'

export function MapPage() {
  const { observationId } = useParams()
  return (
    <PageContainer>
      <PageHeader
        title="Map"
        meta={observationId}
        description="Detections, density and cleanup hotspots for one observation."
      />
    </PageContainer>
  )
}
