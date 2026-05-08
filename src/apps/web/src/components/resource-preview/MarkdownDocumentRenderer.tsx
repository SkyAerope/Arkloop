import { MarkdownRenderer } from '../MarkdownRenderer'
import type { ArtifactRef } from '../../storage'

type Props = {
  content: string
  accessToken?: string
  artifacts?: ArtifactRef[]
  runId?: string
}

export function MarkdownDocumentRenderer({ content, accessToken = '', artifacts = [], runId }: Props) {
  return (
    <div data-preview-renderer="markdown" style={{ padding: '20px 28px' }}>
      <MarkdownRenderer
        content={content}
        artifacts={artifacts}
        accessToken={accessToken}
        runId={runId}
        compact
        allowHtml
      />
    </div>
  )
}
