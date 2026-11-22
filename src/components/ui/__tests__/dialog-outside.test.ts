/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { isEntityComboboxPortalTarget } from '../dialog-outside'

describe('isEntityComboboxPortalTarget', () => {
  it('returns false for null / non-elements', () => {
    expect(isEntityComboboxPortalTarget(null)).toBe(false)
    expect(isEntityComboboxPortalTarget(document.createTextNode('x'))).toBe(false)
  })

  it('returns true when the event target is inside a portaled EntityCombobox panel', () => {
    const portal = document.createElement('div')
    portal.setAttribute('data-entity-combobox-portal', '')
    const option = document.createElement('button')
    option.textContent = 'Celcius'
    portal.appendChild(option)
    document.body.appendChild(portal)

    expect(isEntityComboboxPortalTarget(option)).toBe(true)
    expect(isEntityComboboxPortalTarget(portal)).toBe(true)

    portal.remove()
  })

  it('returns false for ordinary outside clicks', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    expect(isEntityComboboxPortalTarget(el)).toBe(false)
    el.remove()
  })
})
