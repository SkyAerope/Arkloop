import type { CSSProperties, RefObject } from 'react'
import { Loader2, MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { DropdownAction } from '../skills/DropdownAction'
import { statusLabel, statusVariant, type MCPCopy } from './types'
import type { MCPInstall } from '../../api'
import { SettingsSwitch } from '../settings/_SettingsSwitch'

type Props = {
  installs: MCPInstall[]
  loading: boolean
  busyID: string | null
  menuID: string | null
  setMenuID: (id: string | null) => void
  onEdit: (install: MCPInstall) => void
  onDelete: (install: MCPInstall) => void
  onToggle: (install: MCPInstall) => void
  onCheck: (install: MCPInstall) => void
  copy: MCPCopy
  menuRef: RefObject<HTMLDivElement | null>
}

function statusBadgeStyle(status: string): CSSProperties {
  const variant = statusVariant(status)
  switch (variant) {
    case 'success':
      return { background: 'var(--c-status-ok-bg)', color: 'var(--c-status-ok-text)' }
    case 'warning':
      return { background: 'var(--c-status-danger-bg)', color: 'var(--c-status-warning-text)' }
    case 'error':
      return { background: 'var(--c-status-danger-bg)', color: 'var(--c-status-danger-text)' }
    default:
      return { background: 'var(--c-bg-deep)', color: 'var(--c-text-tertiary)' }
  }
}

/** 与 PluginListRow 副行一致：错误优先，否则 URL / 命令 / transport */
function rowSubtitle(install: MCPInstall): { text: string; tone: 'error' | 'muted' } {
  if (install.last_error_message?.trim()) {
    return { text: install.last_error_message.trim(), tone: 'error' }
  }
  const launch = install.launch_spec ?? {}
  if (install.transport === 'stdio') {
    const cmd = typeof launch.command === 'string' ? launch.command.trim() : ''
    return { text: cmd || install.transport, tone: 'muted' }
  }
  const url = typeof launch.url === 'string' ? launch.url.trim() : ''
  return { text: url || install.source_uri?.trim() || install.transport, tone: 'muted' }
}

export function MCPInstallList({
  installs,
  loading,
  busyID,
  menuID,
  setMenuID,
  onEdit,
  onDelete,
  onToggle,
  onCheck,
  copy,
  menuRef,
}: Props) {
  if (loading) {
    return (
      <div className="grid min-h-[220px] place-items-center rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] text-[var(--c-text-muted)]">
        <Loader2 size={18} className="animate-spin" />
      </div>
    )
  }

  if (installs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] px-5 py-6 text-center text-sm text-[var(--c-text-tertiary)]">
        {copy.empty}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {installs.map((install) => {
        const busy = busyID === install.id
        const isOpen = menuID === install.id
        const sub = rowSubtitle(install)

        return (
          <div
            key={install.id}
            className="overflow-hidden rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] transition-colors duration-[140ms] hover:bg-[var(--c-bg-deep)]"
          >
            <div className="grid min-h-[76px] w-full grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-[14px] font-semibold leading-5 text-[var(--c-text-primary)]">
                    {install.display_name}
                  </h3>
                  <span
                    className="inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-medium leading-none"
                    style={busy ? statusBadgeStyle('needs_check') : statusBadgeStyle(install.discovery_status)}
                  >
                    {busy && <Loader2 size={10} className="mr-0.5 animate-spin" />}
                    {busy ? copy.loading : statusLabel(install.discovery_status, copy.status)}
                  </span>
                </div>
                <p
                  className={[
                    'mt-1 truncate text-[12.5px] leading-5',
                    sub.tone === 'error' ? '' : 'text-[var(--c-text-tertiary)]',
                  ].filter(Boolean).join(' ')}
                  style={sub.tone === 'error' ? { color: 'var(--c-status-error-text)' } : undefined}
                  title={sub.text}
                >
                  {sub.text}
                </p>
              </div>

              <div
                className="flex shrink-0 items-center gap-2 justify-self-end"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <SettingsSwitch
                  checked={install.workspace_state?.enabled ?? false}
                  disabled={busy}
                  onChange={() => onToggle(install)}
                />

                <div className="relative shrink-0" ref={isOpen ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={() => setMenuID(isOpen ? null : install.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--c-text-tertiary)] transition-colors hover:bg-[var(--c-bg-deep)]"
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <MoreHorizontal size={14} />
                    )}
                  </button>
                  {isOpen && (
                    <div
                      className="dropdown-menu absolute right-0 top-[calc(100%+4px)] z-50"
                      style={{
                        border: '0.5px solid var(--c-border-subtle)',
                        borderRadius: '10px',
                        padding: '4px',
                        background: 'var(--c-bg-menu)',
                        width: '180px',
                        boxShadow: 'var(--c-dropdown-shadow)',
                      }}
                    >
                      <DropdownAction
                        icon={<Pencil size={14} />}
                        label={copy.edit}
                        onClick={() => {
                          setMenuID(null)
                          onEdit(install)
                        }}
                      />
                      <DropdownAction
                        icon={<RefreshCw size={14} />}
                        label={copy.recheck}
                        onClick={() => {
                          setMenuID(null)
                          onCheck(install)
                        }}
                      />
                      <DropdownAction
                        icon={<Trash2 size={14} />}
                        label={copy.delete}
                        destructive
                        onClick={() => {
                          setMenuID(null)
                          onDelete(install)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
