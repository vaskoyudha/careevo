import { Activity, Archive, BarChart3, Settings2 } from 'lucide-react'
import {
  SETTINGS_CATEGORIES,
  isSettingsCategoryVisible,
  isSettingsLeafVisible,
  resolveSettingsKey,
  type Lang,
  type SettingsLeaf,
} from './settings-nav'
import type { LucideIcon } from 'lucide-react'
import type { SettingsAccess } from './settings-access'

export const SETTINGS_PAGE_GROUPS: { label: Lang; keys: string[] }[] = [
  { label: { en: 'Personal', id: 'Pribadi', zh: '个人' }, keys: ['general', 'workspace', 'data-migration', 'appearance', 'usage'] },
  {
    label: { en: 'Learning & conversation', id: 'Pembelajaran & percakapan', zh: '学习与对话' },
    keys: ['starters', 'attachments', 'video-learning', 'learner-profile', 'progress', 'guardian', 'memory'],
  },
  {
    label: { en: 'Models & services', id: 'Model & layanan', zh: '模型与服务' },
    keys: ['connections', 'llm', 'task-models', 'embedding', 'search', 'voice', 'multimodal'],
  },
  {
    label: { en: 'Features & integrations', id: 'Fitur & integrasi', zh: '功能与集成' },
    keys: ['tools', 'capabilities', 'knowledge'],
  },
  {
    label: { en: 'System', id: 'Sistem', zh: '系统' },
    keys: ['network', 'status', 'about'],
  },
  { label: { en: 'Archived', id: 'Diarsipkan', zh: '已归档' }, keys: ['archive'] },
]

/**
 * Pages laid out as master–detail (a list rail beside an editor). They need the
 * width for both columns: at the shared 960px cap the editor column came out
 * around 590px, so its fields sat in one cramped stack with hundreds of unused
 * pixels beside them. Text-only preference pages stay narrow on purpose.
 */
const WIDE_SETTINGS_PAGES = new Set([
  'connections',
  'llm',
  'embedding',
  'search',
  'voice',
  'multimodal',
])

export function isWideSettingsPage(key: string): boolean {
  return WIDE_SETTINGS_PAGES.has(resolveSettingsKey(key))
}

/**
 * Related service pages share a compact navigation row, with explicit tabs.
 *
 * SiJago has no agent settings, so the family is normally empty and
 * `settingsPageFamily` falls back to a single-entry family (which renders no
 * tab row). Optional chaining keeps that case safe instead of asserting a
 * category that may not exist.
 */
export const SETTINGS_PAGE_FAMILIES: string[][] = [
  SETTINGS_CATEGORIES.find(category => category.key === 'agents')?.children?.map(leaf => leaf.key) ?? [],
].filter(family => family.length > 0)

export function settingsPageFamily(key: string): string[] {
  return SETTINGS_PAGE_FAMILIES.find(family => family.includes(key)) ?? [key]
}

const extraPages: SettingsLeaf[] = [
  {
    key: 'progress',
    label: { en: 'Learning progress', id: 'Kemajuan belajar', zh: '学习进度' },
    blurb: { en: 'Reading progress and recent learning actions', id: 'Kemajuan membaca dan aktivitas pembelajaran terkini', zh: '阅读进度与近期学习操作' },
    icon: BarChart3,
    href: '/settings/progress',
    tile: '',
  },
  {
    key: 'data-migration',
    label: { en: 'Data migration', id: 'Migrasi data', zh: '数据迁移' },
    blurb: { en: 'Discover, migrate and export learning data', id: 'Temukan, migrasikan, dan ekspor data pembelajaran', zh: '查找、迁移和导出学习数据' },
    icon: Archive,
    href: '/settings/data-migration',
    tile: '',
  },
  {
    key: 'usage',
    label: { en: 'Usage statistics', id: 'Statistik penggunaan', zh: '用量统计' },
    blurb: { en: 'Model usage and conversation activity', id: 'Penggunaan model dan aktivitas percakapan', zh: '模型用量与对话活跃情况' },
    icon: BarChart3,
    href: '/settings/usage',
    tile: '',
  },
  {
    key: 'archive',
    label: { en: 'Archived chats', id: 'Chat yang diarsipkan', zh: '已归档的聊天' },
    blurb: {
      en: 'Search, unarchive, or permanently delete archived conversations', id: 'Cari, batalkan pengarsipan, atau hapus permanen percakapan yang diarsipkan',
      zh: '搜索、取消归档或永久删除已归档的对话',
    },
    icon: Archive,
    href: '/settings/archive',
    tile: '',
  },
  {
    key: 'general',
    label: { en: 'General', id: 'Umum', zh: '常规' },
    blurb: {
      en: 'Interface language, response language, and setup help', id: 'Bahasa antarmuka, bahasa respons, dan bantuan pengaturan',
      zh: '界面语言、回复语言与配置帮助',
    },
    icon: Settings2,
    href: '/settings/general',
    tile: '',
  },
  {
    key: 'status',
    label: { en: 'Runtime status', id: 'Status runtime', zh: '运行状态' },
    blurb: {
      en: 'Service readiness, diagnostics, and memory usage', id: 'Kesiapan layanan, diagnostik, dan penggunaan memori',
      zh: '服务就绪情况、诊断与内存占用',
    },
    icon: Activity,
    href: '/settings/status',
    tile: '',
  },
]

/**
 * SiJago hides its backend-plumbing pages from the settings navigator and
 * settings search. The pages stay reachable by direct URL — the onboarding
 * tour, the sidebar version badge, and the readiness panel all deep-link to
 * them — so `visibleSettingsPages` keeps them while `listedSettingsPages`
 * (used by the navigator only) drops them.
 */
export const HIDDEN_SETTINGS_KEYS = new Set([
  // Personal
  'data-migration',
  'usage',
  // Learning & conversation
  'memory',
  // Features & integrations
  'tools',
  'capabilities',
  'knowledge',
  // System
  'network',
  'status',
  'about',
  // Models & services
  'connections',
  'llm',
  'task-models',
  'embedding',
  'search',
  'voice',
  'multimodal',
])

export function visibleSettingsPages(access: SettingsAccess): SettingsLeaf[] {
  return [
    ...extraPages,
    ...SETTINGS_CATEGORIES.filter(category => isSettingsCategoryVisible(category, access))
      .flatMap(category => category.children ?? [{ ...category, tile: '' }])
      .filter(
        leaf => isSettingsLeafVisible(leaf, access) && resolveSettingsKey(leaf.key) === leaf.key
      ),
  ]
}

/** Pages shown in the settings navigator and search (excludes hidden pages). */
export function listedSettingsPages(access: SettingsAccess): SettingsLeaf[] {
  return visibleSettingsPages(access).filter(leaf => !HIDDEN_SETTINGS_KEYS.has(leaf.key))
}

export function settingsPageLabel(key: string, fallback: Lang): Lang {
  if (key === 'llm') return { en: 'Language models', id: 'Model bahasa', zh: '语言模型' }
  if (key === 'starters') return { en: 'Conversation', id: 'Percakapan', zh: '对话' }
  if (key === 'connections') return { en: 'Providers', id: 'Penyedia', zh: '提供方' }
  if (key === 'knowledge') return { en: 'Knowledge & documents', id: 'Pengetahuan & dokumen', zh: '知识与文档' }
  return fallback
}

/** Icon for a page as the navigation shows it. */
export function settingsPageIcon(_key: string, fallback: LucideIcon): LucideIcon {
  return fallback
}

/** Old links sometimes placed ?profile after the fragment. Preserve it too. */
export function legacySettingsDestination(hash: string, search: string): string {
  const [rawKey, hashQuery = ''] = hash.replace(/^#/, '').split('?')
  let key = 'general'
  try {
    key = resolveSettingsKey(decodeURIComponent(rawKey || 'general'))
  } catch {
    /* malformed old URL */
  }
  const known = new Set([
    ...extraPages.map(page => page.key),
    ...SETTINGS_CATEGORIES.flatMap(
      category => category.children?.map(leaf => leaf.key) ?? [category.key]
    ),
  ])
  if (!known.has(key)) key = 'general'
  const query = new URLSearchParams(search)
  new URLSearchParams(hashQuery).forEach((value, name) => query.set(name, value))
  return `/settings/${key}${query.size ? `?${query}` : ''}`
}
