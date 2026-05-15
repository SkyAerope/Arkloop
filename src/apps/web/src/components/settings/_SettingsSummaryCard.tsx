import type { KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  SETTINGS_INTERACTIVE_CARD_CLASS,
  SETTINGS_INTERACTIVE_CARD_BASE_CLASS,
} from './_SettingsLayout'

export function SettingsSummaryCard({
  children,
  onClick,
  className,
  minHeightClass = 'min-h-[138px]',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  minHeightClass?: string
}) {
  const interactive = onClick !== undefined

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onClick?.()
  }

  return (
    <motion.div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      transition={interactive ? { type: 'spring', stiffness: 620, damping: 22, mass: 0.42 } : undefined}
      className={[
        'group relative flex flex-col p-4 text-left',
        interactive ? SETTINGS_INTERACTIVE_CARD_CLASS : `${SETTINGS_INTERACTIVE_CARD_BASE_CLASS} border-[var(--c-border-subtle)]`,
        minHeightClass,
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </motion.div>
  )
}

export function SettingsSummaryCardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--c-bg-deep)] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-[var(--c-text-muted)]">
      {children}
    </span>
  )
}

export function SettingsSummaryCardLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium leading-tight text-[var(--c-text-muted)]">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[var(--c-text-secondary)]">{value}</div>
    </div>
  )
}
