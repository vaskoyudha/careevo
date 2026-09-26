import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  GeneratedFileCards,
  UserMessage,
} from '@/features/chat/messages/ChatMessageList'
import { WatchingProvider } from '@/context/WatchingContext'
import { initI18n } from '@/i18n/init'

initI18n('en')
vi.mock('@/lib/partners-api', () => ({ getPartner: async () => null }))
vi.mock('@/lib/partner-groups-api', () => ({
  getPartnerGroup: async () => null,
}))
afterEach(cleanup)

/**
 * The conversation reads rounded: the learner's own turn sits in one generous
 * bubble rather than a tight 16px one, and the cards a turn brings with it
 * carry the app's card radius. Both are pinned here so a later pass cannot
 * quietly square them off.
 *
 * jsdom loads no stylesheet, so the class list is all that is assertable; that
 * these classes compile to real declarations is the Tailwind build's job.
 */
const BUBBLE_RADIUS = 'rounded-[26px]'
const CARD_RADIUS = 'rounded-2xl'

/** The nearest ancestor-or-self carrying `radius`, found from some text. */
function radiusAround(container: HTMLElement, text: string): string {
  const start = [...container.querySelectorAll('*')]
    .filter(node => node.textContent?.includes(text))
    .pop()
  let node: HTMLElement | null = start as HTMLElement | null
  while (node) {
    if ((node.className ?? '').toString().includes(BUBBLE_RADIUS))
      return node.className.toString()
    node = node.parentElement
  }
  throw new Error(
    `no ancestor of ${JSON.stringify(text)} carries ${BUBBLE_RADIUS}`,
  )
}

it('rounds the learner bubble to the conversation radius', async () => {
  const { container } = render(
    <WatchingProvider>
      <UserMessage
        index={0}
        msg={{ role: 'user', content: 'Explain recursion to me.' }}
      />
    </WatchingProvider>,
  )
  // The message resolves its consultation reference on mount; letting that
  // settle inside the test keeps the update inside act() rather than leaking a
  // warning after the case has already passed.
  await screen.findByText('Explain recursion to me.')
  expect(radiusAround(container, 'Explain recursion to me.')).toContain(
    BUBBLE_RADIUS,
  )
})

it('rounds a generated-file card to the card radius', () => {
  const { container } = render(
    <GeneratedFileCards
      attachments={[
        {
          type: 'file',
          id: 'recursion-notes',
          filename: 'recursion-notes.md',
          mime_type: 'text/markdown',
          generated: true,
        },
      ]}
    />,
  )
  const cards = [...container.querySelectorAll('button')].filter(button =>
    button.className.toString().includes(CARD_RADIUS),
  )
  expect(cards).toHaveLength(1)
})
