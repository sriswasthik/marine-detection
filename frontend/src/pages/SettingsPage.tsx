import { Banner } from '@/components/ui'
import {
  AboutSection,
  DataSourceSection,
  MapSection,
  ModelCardSection,
  ThresholdsSection,
  UnitsSection,
} from '@/features/settings/SettingsSections'
import { useSettingsStore } from '@/features/settings/settingsContext'
import { ENV } from '@/lib/env'
import { PageContainer, PageHeader } from './PageHeader'

/** Units, map defaults, thresholds, data source, model card and attributions. Saved as you go. */
export function SettingsPage() {
  const store = useSettingsStore()
  return (
    <PageContainer>
      <div className="flex max-w-4xl flex-col gap-8">
        <PageHeader
          title="Settings"
          description="Each change applies and saves at once, in this browser."
        />
        {store.loadStatus() === 'corrupt' ? (
          <Banner tone="warning" title="Settings were reset">
            The saved settings could not be read, so the defaults are in use. Changes you make now
            are saved normally.
          </Banner>
        ) : null}
        <div className="flex flex-col">
          <UnitsSection />
          <MapSection />
          <ThresholdsSection />
          <DataSourceSection />
          <ModelCardSection />
          <AboutSection appName={ENV.appName} />
        </div>
      </div>
    </PageContainer>
  )
}
