// Tooltip placement writes that skip unchanged values: an identical attribute write still records a mutation, an identical style write dirties nothing.
export const writePosition = (element: HTMLElement, left: number, top: number): void => {
  const nextLeft = `${left}px`;
  const nextTop = `${top}px`;
  if (element.style.left !== nextLeft) {
    element.style.left = nextLeft;
  }
  if (element.style.top !== nextTop) {
    element.style.top = nextTop;
  }
};

export const writePlacementSide = (element: HTMLElement, placement: string): void => {
  if (element.dataset.placement !== placement) {
    element.dataset.placement = placement;
  }
};
