import type { Locale } from '../../locales'

function zhCount(count: string, noun: string): string {
  return `${count} ${noun}`
}

export function localizeTimelineLabel(label: string, locale: Locale): string {
  if (locale !== 'zh') return label
  const text = label.trim()
  const trailingDots = text.endsWith('...')
  const core = trailingDots ? text.slice(0, -3) : text

  const exact: Record<string, string> = {
    Completed: '已完成',
    Working: '处理中',
    Running: '运行中',
    Editing: '编辑中',
    'Edit completed': '编辑已完成',
    'Exploring code': '正在查看代码',
    'Explored code': '已查看代码',
    'Searching code': '正在搜索代码',
    'Searched code': '已搜索代码',
    'Listing files': '正在列出文件',
    'Listed files': '已列出文件',
    'Reading file': '正在读取文件',
    'Read file': '已读取文件',
    'Writing file': '正在写入文件',
    'Wrote file': '已写入文件',
    'Editing file': '正在编辑文件',
    'Edited file': '已编辑文件',
    'Running command': '正在运行命令',
    'Run command': '运行命令',
    'Loaded tools': '已加载工具',
    'Loading tools': '正在加载工具',
    'Loaded skill': '已加载技能',
    'Loading skill': '正在加载技能',
    'Agent running': '子代理运行中',
    'Agent completed': '子代理已完成',
    'Fetch completed': '获取已完成',
    'Fetching': '正在获取',
    'Search completed': '搜索已完成',
    'Searching': '搜索中',
    'Reviewing sources': '正在检查来源',
    'Enter Plan Mode': '进入计划模式',
    'Exit Plan Mode': '退出计划模式',
    'Generating image': '正在生成图片',
    'Generated image': '已生成图片',
    'Image generation failed': '图片生成失败',
    'Updated todos': '已更新待办',
    'Read todos': '已读取待办',
  }
  if (exact[core]) return trailingDots ? `${exact[core]}...` : exact[core]

  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^(\d+) steps? completed$/, (m) => `${m[1]} 步已完成`],
    [/^Listed (\d+) files?$/, (m) => `已列出 ${zhCount(m[1]!, '个文件')}`],
    [/^Read (\d+) files?$/, (m) => `已读取 ${zhCount(m[1]!, '个文件')}`],
    [/^Read a file$/, () => '已读取 1 个文件'],
    [/^(\d+) searches$/, (m) => `${m[1]} 次搜索`],
    [/^Ran (\d+) commands?$/, (m) => `已运行 ${zhCount(m[1]!, '条命令')}`],
    [/^Wrote (\d+) files?$/, (m) => `已写入 ${zhCount(m[1]!, '个文件')}`],
    [/^Wrote (.+)$/, (m) => `已写入 ${m[1]}`],
    [/^Writing (.+)$/, (m) => `正在写入 ${m[1]}`],
    [/^Edited (\d+) files?$/, (m) => `已编辑 ${zhCount(m[1]!, '个文件')}`],
    [/^Edited (.+)$/, (m) => `已编辑 ${m[1]}`],
    [/^Editing (.+)$/, (m) => `正在编辑 ${m[1]}`],
    [/^Read (.+)$/, (m) => `已读取 ${m[1]}`],
    [/^Reading (.+)$/, (m) => `正在读取 ${m[1]}`],
    [/^Listed (.+)$/, (m) => `已列出 ${m[1]}`],
    [/^Listing (.+)$/, (m) => `正在列出 ${m[1]}`],
    [/^Searched (.+)$/, (m) => `已搜索 ${m[1]}`],
    [/^Searching (.+)$/, (m) => `正在搜索 ${m[1]}`],
    [/^(\d+) agent tasks? completed$/, (m) => `${m[1]} 个子代理任务已完成`],
    [/^(\d+) fetches completed$/, (m) => `${m[1]} 次获取已完成`],
    [/^Generated (\d+) images$/, (m) => `已生成 ${m[1]} 张图片`],
    [/^(\d+) image generations failed$/, (m) => `${m[1]} 次图片生成失败`],
  ]

  for (const [re, format] of patterns) {
    const match = core.match(re)
    if (match) {
      const value = format(match)
      return trailingDots ? `${value}...` : value
    }
  }

  return label
}
