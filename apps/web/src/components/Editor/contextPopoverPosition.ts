export function calculateContextPopoverPosition(params: {
  left: number;
  top: number;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  anchorTop?: number;
  anchorBottom?: number;
  margin?: number;
  gap?: number;
}) {
  const margin = params.margin ?? 12;
  const gap = params.gap ?? 8;
  const maxLeft = Math.max(margin, params.viewportWidth - params.popoverWidth - margin);
  const maxTop = Math.max(margin, params.viewportHeight - params.popoverHeight - margin);
  let desiredTop = params.top;

  if (params.anchorTop !== undefined && params.anchorBottom !== undefined) {
    const below = params.anchorBottom + gap;
    const above = params.anchorTop - params.popoverHeight - gap;
    const fitsBelow = below + params.popoverHeight <= params.viewportHeight - margin;
    const fitsAbove = above >= margin;
    desiredTop = fitsBelow
      ? below
      : fitsAbove
        ? above
        : params.anchorTop > params.viewportHeight / 2
          ? above
          : below;
  }

  return {
    left: Math.min(Math.max(params.left, margin), maxLeft),
    top: Math.min(Math.max(desiredTop, margin), maxTop)
  };
}
