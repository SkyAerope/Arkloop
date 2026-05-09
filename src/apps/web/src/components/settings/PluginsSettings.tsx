import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToast } from '@arkloop/shared'
import {
  Blocks,
  Check,
  Download,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react'
import {
  getPluginEnablement,
  getPluginRuntimeStatus,
  installPluginRuntime,
  listPlugins,
  setPluginEnabled,
  type PluginEnablement,
  type PluginPackage,
  type PluginRuntimeState,
} from '../../api'
import { useLocale } from '../../contexts/LocaleContext'
import { SettingsPage } from './_SettingsLayout'
import { SettingsButton, SettingsIconButton } from './_SettingsButton'
import { SettingsModalFrame } from './_SettingsModalFrame'
import { SettingsSegmentedControl } from './_SettingsSegmentedControl'
import { SettingsSummaryCard } from './_SettingsSummaryCard'

type PluginTab = 'installed' | 'marketplace'

type PluginStatus = {
  enablement: PluginEnablement | null
  runtime: PluginRuntimeState | null
}

type LoadState = {
  plugins: PluginPackage[]
  statusByID: Record<string, PluginStatus>
}

type Props = {
  accessToken: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasRuntime(manifest: Record<string, unknown>): boolean {
  return isRecord(manifest.runtime) && Object.keys(manifest.runtime).length > 0
}

function sourceLabel(sourceKind: string, builtIn: string, custom: string) {
  return sourceKind === 'builtin' ? builtIn : custom
}

export function PluginsSettings({ accessToken }: Props) {
  const { t } = useLocale()
  const { addToast } = useToast()
  const ds = t.desktopSettings
  const ps = ds.pluginsPage
  const [tab, setTab] = useState<PluginTab>('installed')
  const [state, setState] = useState<LoadState>({ plugins: [], statusByID: {} })
  const [loading, setLoading] = useState(true)
  const [busyID, setBusyID] = useState<string | null>(null)
  const [selectedPluginID, setSelectedPluginID] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const plugins = await listPlugins(accessToken)
      const statusPairs = await Promise.all(
        plugins.map(async (plugin) => {
          const [enablement, runtime] = await Promise.all([
            getPluginEnablement(accessToken, plugin.id),
            getPluginRuntimeStatus(accessToken, plugin.id),
          ])
          return [plugin.id, { enablement, runtime }] as const
        }),
      )
      setState({ plugins, statusByID: Object.fromEntries(statusPairs) })
    } catch (error) {
      addToast(error instanceof Error ? error.message : ps.loadFailed, 'error')
    } finally {
      setLoading(false)
    }
  }, [accessToken, addToast, ps.loadFailed])

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => state.plugins.filter((plugin) => plugin.is_active), [state.plugins])
  const selectedPlugin = useMemo(
    () => items.find((plugin) => plugin.id === selectedPluginID) ?? null,
    [items, selectedPluginID],
  )

  const installRuntime = useCallback(async (plugin: PluginPackage) => {
    setBusyID(plugin.id)
    try {
      const runtime = await installPluginRuntime(accessToken, plugin.id)
      setState((current) => ({
        ...current,
        statusByID: {
          ...current.statusByID,
          [plugin.id]: { ...(current.statusByID[plugin.id] ?? { enablement: null }), runtime },
        },
      }))
    } catch (error) {
      addToast(error instanceof Error ? error.message : ps.runtimeInstallFailed, 'error')
    } finally {
      setBusyID(null)
    }
  }, [accessToken, addToast, ps.runtimeInstallFailed])

  const toggleEnabled = useCallback(async (plugin: PluginPackage, enabled: boolean) => {
    setBusyID(plugin.id)
    try {
      const enablement = await setPluginEnabled(accessToken, plugin.id, enabled)
      setState((current) => ({
        ...current,
        statusByID: {
          ...current.statusByID,
          [plugin.id]: { ...(current.statusByID[plugin.id] ?? { runtime: null }), enablement },
        },
      }))
    } catch (error) {
      addToast(error instanceof Error ? error.message : enabled ? ps.enableFailed : ps.disableFailed, 'error')
    } finally {
      setBusyID(null)
    }
  }, [accessToken, addToast, ps.disableFailed, ps.enableFailed])

  const renderPluginCard = (plugin: PluginPackage) => {
    const status = state.statusByID[plugin.id]
    const enabled = status?.enablement?.enabled ?? false
    const runtimeStatus = status?.runtime?.status ?? 'not_installed'
    const runtimeReady = runtimeStatus === 'installed'
    const runtimeNeeded = hasRuntime(plugin.manifest)
    const busy = busyID === plugin.id

    return (
      <SettingsSummaryCard
        key={plugin.package_id}
        onClick={() => setSelectedPluginID(plugin.id)}
        minHeightClass="min-h-[76px]"
        className="justify-center py-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] text-[var(--c-text-secondary)]">
            <Blocks size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--c-text-primary)]">{plugin.display_name}</h3>
            <p className="mt-1 truncate text-[12px] leading-tight text-[var(--c-text-muted)]">
              {plugin.description || sourceLabel(plugin.source_kind, ps.builtIn, ps.custom)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            {runtimeNeeded && !runtimeReady && (
              <SettingsIconButton
                label={ps.installRuntime}
                className="h-8 w-8"
                disabled={busy}
                onClick={() => void installRuntime(plugin)}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              </SettingsIconButton>
            )}
            <SettingsIconButton
              label={enabled ? ps.disable : ps.enable}
              className="h-8 w-8"
              disabled={busy || (runtimeNeeded && !runtimeReady && !enabled)}
              onClick={() => void toggleEnabled(plugin, !enabled)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : enabled ? <Check size={14} /> : <Plus size={14} />}
            </SettingsIconButton>
          </div>
        </div>
      </SettingsSummaryCard>
    )
  }

  return (
    <SettingsPage title={ds.pluginsTitle} className="max-w-[760px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SettingsSegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'installed', label: ps.installedTab },
            { value: 'marketplace', label: ps.marketplaceTab },
          ]}
        />
        <SettingsIconButton label={ps.refresh} onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </SettingsIconButton>
      </div>

      {tab === 'installed' ? (
        loading ? (
          <div className="grid min-h-[220px] place-items-center rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] text-[var(--c-text-muted)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] px-5 py-6 text-sm text-[var(--c-text-tertiary)]">
            {ps.emptyInstalled}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{items.map(renderPluginCard)}</div>
        )
      ) : (
        <div className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)] px-5 py-6">
          <div className="text-sm font-medium text-[var(--c-text-primary)]">{ps.emptyMarketplaceTitle}</div>
          <div className="mt-1 text-[12.5px] leading-5 text-[var(--c-text-tertiary)]">{ps.emptyMarketplace}</div>
        </div>
      )}

      {selectedPlugin && (
        <PluginDetailModal
          plugin={selectedPlugin}
          status={state.statusByID[selectedPlugin.id] ?? { enablement: null, runtime: null }}
          busy={busyID === selectedPlugin.id}
          labels={ps}
          onClose={() => setSelectedPluginID(null)}
          onInstallRuntime={() => void installRuntime(selectedPlugin)}
          onToggleEnabled={(enabled) => void toggleEnabled(selectedPlugin, enabled)}
        />
      )}
    </SettingsPage>
  )
}

function PluginDetailModal({
  plugin,
  status,
  busy,
  labels,
  onClose,
  onInstallRuntime,
  onToggleEnabled,
}: {
  plugin: PluginPackage
  status: PluginStatus
  busy: boolean
  labels: ReturnType<typeof useLocale>['t']['desktopSettings']['pluginsPage']
  onClose: () => void
  onInstallRuntime: () => void
  onToggleEnabled: (enabled: boolean) => void
}) {
  const enabled = status.enablement?.enabled ?? false
  const runtimeStatus = status.runtime?.status ?? 'not_installed'
  const runtimeNeeded = hasRuntime(plugin.manifest)
  const runtimeReady = runtimeStatus === 'installed'

  return (
    <SettingsModalFrame
      open
      title={plugin.display_name}
      onClose={onClose}
      width={560}
      footer={
        <>
          {runtimeNeeded && !runtimeReady && (
            <SettingsButton
              size="modal"
              variant="secondary"
              icon={busy ? <Loader2 className="animate-spin" /> : <Download />}
              disabled={busy}
              onClick={onInstallRuntime}
            >
              {labels.installRuntime}
            </SettingsButton>
          )}
          <SettingsButton
            size="modal"
            variant={enabled ? 'secondary' : 'primary'}
            icon={busy ? <Loader2 className="animate-spin" /> : enabled ? <Check /> : <Plus />}
            disabled={busy || (runtimeNeeded && !runtimeReady && !enabled)}
            onClick={() => onToggleEnabled(!enabled)}
          >
            {enabled ? labels.disable : labels.enable}
          </SettingsButton>
        </>
      }
    >
      <div className="mt-6 min-w-0 space-y-6">
        {plugin.description && (
          <p className="px-2.5 text-[13px] leading-5 text-[var(--c-text-secondary)]">{plugin.description}</p>
        )}

        <PluginDetailSection title={labels.overview}>
          <PluginDetailCard>
            <PluginDetailRow label={labels.pluginId}>
              <PluginValue value={plugin.id} mono />
            </PluginDetailRow>
            <PluginDetailRow label={labels.version}>
              <PluginValue value={plugin.version} />
            </PluginDetailRow>
            <PluginDetailRow label={labels.source}>
              <PluginValue value={plugin.source_kind} />
            </PluginDetailRow>
            <PluginDetailRow label={labels.status}>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <PluginPill>{enabled ? labels.enabled : labels.disabled}</PluginPill>
                {runtimeNeeded && <PluginPill>{runtimeReady ? labels.ready : labels.needsSetup}</PluginPill>}
              </div>
            </PluginDetailRow>
            <PluginDetailRow label={labels.runtimeStatus}>
              <PluginValue value={runtimeNeeded ? runtimeStatus : labels.notRequired} />
            </PluginDetailRow>
          </PluginDetailCard>
        </PluginDetailSection>
      </div>
    </SettingsModalFrame>
  )
}

function PluginDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h4 className="pl-2.5 text-[13px] font-normal text-[var(--c-text-secondary)]">{title}</h4>
      {children}
    </section>
  )
}

function PluginDetailCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-bg-menu)]">
      {children}
    </div>
  )
}

function PluginDetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative grid items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,390px)] sm:gap-6 [&+&]:before:absolute [&+&]:before:left-5 [&+&]:before:right-5 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-[var(--c-border-subtle)] [&+&]:before:content-['']">
      <div className="min-w-0 text-[13px] font-medium text-[var(--c-text-primary)]">{label}</div>
      <div className="min-w-0 sm:w-full sm:justify-self-end">{children}</div>
    </div>
  )
}

function PluginValue({
  value,
  mono,
}: {
  value: string
  mono?: boolean
}) {
  return (
    <div
      className={[
        'truncate text-right text-[13px] font-medium leading-5 text-[var(--c-text-secondary)]',
        mono ? 'font-mono text-[12px]' : '',
      ].filter(Boolean).join(' ')}
      title={value}
    >
      {value}
    </div>
  )
}

function PluginPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md px-2 py-1 text-xs font-medium text-[var(--c-text-muted)]" style={{ background: 'var(--c-bg-sub)' }}>
      {children}
    </span>
  )
}
