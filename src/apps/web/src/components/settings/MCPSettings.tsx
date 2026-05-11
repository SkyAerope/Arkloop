import { MCPSettingsContent } from '../MCPSettingsContent'

type Props = {
  accessToken: string
}

export function MCPSettings({ accessToken }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col px-1 pb-8">
      <MCPSettingsContent accessToken={accessToken} />
    </div>
  )
}
