import { useParams } from 'react-router-dom'
import { PageContainer, PageHeader } from './PageHeader'

export function ReportPage() {
  const { id } = useParams()
  return (
    <PageContainer>
      <PageHeader
        title="Cleanup report"
        meta={id}
        description="A printable summary of hotspots and measurements for field teams."
      />
    </PageContainer>
  )
}
