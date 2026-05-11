import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { DropdownAction } from '../skills/DropdownAction'
import { statusLabel, statusVariant, type MCPCopy } from './types'
import type { MCPInstall } from '../../api'
import { SettingsSwitch } from '../settings/_SettingsSwitch'
import { SettingsButton } from '../settings/_SettingsButton'

type Props = {
  installs: MCPInstall[]
  loading: boolean
  busyID: string | null
  onEdit: (install: MCPInstall) => void
  onDelete: (install: MCPInstall) => void
  onToggle: (install: MCPInstall) => void
  onCheck: (install: MCPInstall) => void
  copy: MCPCopy
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

const PANEL_W = 220
const PANEL_EST_H = 140

type PanelPos = { top: number; left: number }

export function MCPInstallList({
  installs,
  loading,
  busyID,
  onEdit,
  onDelete,
  onToggle,
  onCheck,
  copy,
}: Props) {
  const [actionForId, setActionForId] = useState<string | null>(null)
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const triggerRefs = useRef<Record<string, HTMLSpanElement | null>>({})

  const openPanel = (id: string) => {
    setActionForId((prev) => (prev === id ? null : id))
  }

  useLayoutEffect(() => {
    if (!actionForId) {
      setPanelPos(null)
      return
    }
    const el = triggerRefs.current[actionForId]
    if (!el) {
      setPanelPos(null)
      return
    }
    const r = el.getBoundingClientRect()
    let left = r.right - PANEL_W
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_W - 8))
    let top = r.bottom + 6
    if (top + PANEL_EST_H > window.innerHeight - 8) {
      top = Math.max(8, r.top - PANEL_EST_H - 6)
    }
    setPanelPos({ top, left })
  }, [actionForId])

  useEffect(() => {
    if (!actionForId) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[data-mcp-actions-popover]') || t.closest('[data-mcp-action-trigger]')) return
      setActionForId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [actionForId])

  useEffect(() => {
    if (!actionForId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionForId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [actionForId])

  useEffect(() => {
    if (!actionForId) return
    const close = () => setActionForId(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [actionForId])

  const actionPanel =
    actionForId && panelPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            data-mcp-actions-popover
            className="fixed z-[200] overflow-hidden rounded-[10px] border-[0.5px] border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] p-1 shadow-[var(--c-dropdown-shadow)]"
            style={{ top: panelPos.top, left: panelPos.left, width: PANEL_W }}
          >
            {(() => {
              const inst = installs.find((i) => i.id === actionForId)
              if (!inst) return null
              return (
                <>
                  <DropdownAction
                    icon={<Pencil size={14} />}
                    label={copy.edit}
                    onClick={() => {
                      setActionForId(null)
                      onEdit(inst)
                    }}
                  />
                  <DropdownAction
                    icon={<RefreshCw size={14} />}
                    label={copy.recheck}
                    onClick={() => {
                      setActionForId(null)
                      onCheck(inst)
                    }}
                  />
                  <DropdownAction
                    icon={<Trash2 size={14} />}
                    label={copy.delete}
                    destructive
                    onClick={() => {
                      setActionForId(null)
                      onDelete(inst)
                    }}
                  />
                </>
              )
            })()}
          </div>,
          document.body,
        )
      : null

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
    <>
      <div className="grid gap-3">
        {installs.map((install) => {
          const busy = busyID === install.id
          const sub = rowSubtitle(install)

          const handleMainKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
            if (busy) return
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            onEdit(install)
          }

          return (
            <div
              key={install.id}
              className="overflow-hidden rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] transition-colors duration-[140ms] hover:bg-[var(--c-bg-deep)]"
            >
              <div className="grid w-full grid-cols-1 items-stretch sm:grid-cols-[minmax(0,1fr)_auto]">
                <div
                  role="button"
                  tabIndex={busy ? -1 : 0}
                  className={[
                    'grid min-h-[76px] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-accent)]',
                    busy ? 'pointer-events-none opacity-50' : '',
                  ].join(' ')}
                  onClick={() => {
                    if (!busy) onEdit(install)
                  }}
                  onKeyDown={handleMainKeyDown}
                >
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
                  <ChevronRight size={16} className="shrink-0 text-[var(--c-text-muted)]" aria-hidden />
                </div>

                <div
                  className="flex items-center gap-2 border-t border-[var(--c-border-subtle)] px-4 py-3 sm:border-t-0 sm:border-l sm:pl-4"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <SettingsSwitch
                    checked={install.workspace_state?.enabled ?? false}
                    disabled={busy}
                    onChange={() => onToggle(install)}
                  />
                  <span
                    ref={(el) => {
                      triggerRefs.current[install.id] = el
                    }}
                    data-mcp-action-trigger
                    className="inline-flex shrink-0"
                  >
                    <SettingsButton
                      variant="secondary"
                      size="default"
                      disabled={busy}
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        openPanel(install.id)
                      }}
                    >
                      {copy.actions}
                    </SettingsButton>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {actionPanel}
    </>
  )
}
