import { useLocale } from '../../contexts/LocaleContext'
import { MCPSettingsContent } from '../MCPSettingsContent'
import { SettingsPage } from './_SettingsLayout'

type Props = {
  accessToken: string
}

export function MCPSettings({ accessToken }: Props) {
  const { t } = useLocale()
  return (
    <SettingsPage title={t.desktopSettings.mcpTitle} className="max-w-[760px]">
      <MCPSettingsContent accessToken={accessToken} />
    </SettingsPage>
  )
}
