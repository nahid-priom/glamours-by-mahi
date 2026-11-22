/** Portaled EntityCombobox panels live outside DialogContent; clicks must not dismiss the dialog. */
export const ENTITY_COMBOBOX_PORTAL_SELECTOR = '[data-entity-combobox-portal]'

export function isEntityComboboxPortalTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(ENTITY_COMBOBOX_PORTAL_SELECTOR))
}
