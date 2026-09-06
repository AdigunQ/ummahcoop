export function selectPosition(
  rect: { left: number; top: number; bottom: number; width: number },
  viewport: { width: number; height: number }
) {
  const margin = 12
  const gap = 8
  const below = Math.max(0, viewport.height - rect.bottom - gap - margin)
  const above = Math.max(0, rect.top - gap - margin)
  const opensBelow = below >= 240 || below >= above
  const width = Math.min(Math.max(rect.width, 260), Math.max(0, viewport.width - margin * 2))
  return {
    left: Math.max(margin, Math.min(rect.left, viewport.width - width - margin)),
    width,
    top: opensBelow ? rect.bottom + gap : undefined,
    // Anchor the bottom edge, not an estimated top: filtered menus can shrink.
    bottom: opensBelow ? undefined : Math.max(margin, viewport.height - rect.top + gap),
    maxHeight: Math.min(340, opensBelow ? below : above),
  }
}
