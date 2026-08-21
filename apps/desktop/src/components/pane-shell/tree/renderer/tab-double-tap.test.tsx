import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registry } from '@/contrib/registry'

import { group, type GroupNode } from '../model'
import { $layoutTree } from '../store'

import { TreeGroup } from './tree-group'

/**
 * Double-tap ownership on the zone header (bug: session-tab double-click).
 *
 * The header strip owns a synthesized double-tap that hides the zone's
 * chrome (`headerHidden`). That gesture must NEVER ride on the tabs: a
 * double-click on a tab is the browser rename/select reflex, and firing the
 * hide there stranded the user — the ZoneMenu carrying "Show header" lives
 * on the very strip that just vanished.
 */

let root: null | Root = null
let container: HTMLDivElement | null = null
let disposePanes: (() => void)[] = []

function render(ui: ReactNode) {
  if (!container) {
    container = globalThis.document.createElement('div')
    globalThis.document.body.append(container)
    root = createRoot(container)
  }

  act(() => {
    root!.render(ui)
  })
}

/** Two panes stacked in one group — the strip renders real tabs. */
function twoTabGroup(): GroupNode {
  return group(['alpha', 'beta'], { active: 'alpha', headerHidden: false, id: 'zone-under-test' })
}

const pointer = (type: string, target: Element | Window) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })

  // React reads button off the native event for its synthetic pointer type.
  Object.defineProperty(ev, 'button', { value: 0 })
  target.dispatchEvent(ev)
}

/** Press + sub-threshold release = a tap (drag-session synthesizes taps). */
const tap = (target: Element) => {
  act(() => {
    pointer('pointerdown', target)
    pointer('pointerup', window)
  })
}

const headerHiddenNow = () => {
  const tree = $layoutTree.get()

  return tree?.type === 'group' && tree.id === 'zone-under-test' ? Boolean(tree.headerHidden) : undefined
}

beforeEach(() => {
  vi.stubGlobal('CSS', { escape: (value: string) => value })

  disposePanes = [
    registry.register({ area: 'panes', id: 'alpha', render: () => <div>Alpha</div>, title: 'Alpha' }),
    registry.register({ area: 'panes', id: 'beta', render: () => <div>Beta</div>, title: 'Beta' })
  ]

  const node = twoTabGroup()
  $layoutTree.set(node)
  render(<TreeGroup node={node} parentAxis="column" />)
})

afterEach(() => {
  if (root) {
    act(() => root!.unmount())
  }

  container?.remove()
  root = null
  container = null

  for (const dispose of disposePanes) {
    dispose()
  }

  disposePanes = []
  $layoutTree.set(null)
  vi.unstubAllGlobals()
})

describe('header double-tap ownership', () => {
  it('does NOT hide the tab bar on a tab double-click', () => {
    const tab = globalThis.document.querySelector('[data-tree-tab="alpha"]')!

    tap(tab)
    tap(tab)

    expect(headerHiddenNow()).toBe(false)
  })

  it('still hides the chrome on a header-strip double-tap', () => {
    const strip = globalThis.document.querySelector('[data-zone-tabstrip="zone-under-test"]')!

    tap(strip)
    tap(strip)

    expect(headerHiddenNow()).toBe(true)
  })
})
