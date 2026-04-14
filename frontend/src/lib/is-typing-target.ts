/** Indica se o foco está em campo de texto — atalhos globais não devem interceptar. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[role="textbox"]')) return true;
  if (target.closest('[role="combobox"]')) return true;
  return false;
}
