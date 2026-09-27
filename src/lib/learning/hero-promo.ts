export interface PromoCardMeasure {
  left: number;
  width: number;
}

/**
 * Scroll distance at which the last card's right edge meets the viewport's.
 *
 * One definition, because two callers clamp to it: `closestPromoIndex` needs it
 * to turn a scroll position into progress, and `promoCardOffset` needs it to
 * clamp a centred card back inside the scroller. Two copies of this formula
 * drifting apart is precisely how a carousel ends up "snapping" to a position
 * the dots do not agree with.
 */
function maxScrollPromo(
  cards: PromoCardMeasure[],
  viewportWidth: number,
): number {
  const lastCard = cards[cards.length - 1];
  if (!lastCard) return 0;
  return Math.max(0, lastCard.left + lastCard.width - viewportWidth);
}

export function closestPromoIndex(
  scrollLeft: number,
  viewportWidth: number,
  cards: PromoCardMeasure[],
): number {
  if (cards.length === 0) return 0;

  const maxScroll = maxScrollPromo(cards, viewportWidth);

  if (maxScroll === 0) return 0;

  const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
  return Math.min(cards.length - 1, Math.round(progress * (cards.length - 1)));
}

/**
 * The `scrollLeft` that puts card `index` in the middle of the viewport.
 *
 * This is the **snap geometry of the carousel**, so it is also what the cards'
 * `scroll-snap-align: center` resolves to: a snap point and a dot target are the
 * same number, by construction, instead of two formulas that happen to agree.
 * `scroll-snap-align: start` was the old card alignment, and it disagreed —
 * measured at 1440px the only reachable snap positions were `0` and `509`, so
 * the middle card could not be reached at all and the middle dot did nothing.
 *
 * Clamped at both ends: the first and last cards cannot be perfectly centred
 * (there is nothing on the far side of them), so they settle against the edge.
 */
export function promoCardOffset(
  index: number,
  viewportWidth: number,
  cards: PromoCardMeasure[],
): number {
  if (cards.length === 0) return 0;

  const card = cards[Math.min(Math.max(0, Math.round(index)), cards.length - 1)];
  const centre = card.left + card.width / 2 - viewportWidth / 2;

  return Math.min(maxScrollPromo(cards, viewportWidth), Math.max(0, centre));
}

/**
 * Where a released drag should settle: the centred offset of whatever card the
 * drag ended nearest.
 *
 * Shares `closestPromoIndex` with the active-dot readout, so the dot that lights
 * up is always the card the scroller settles on — a second "nearest card"
 * formula here would be free to pick a different card than the dot shows.
 */
export function promoSnapLeft(
  scrollLeft: number,
  viewportWidth: number,
  cards: PromoCardMeasure[],
): number {
  return promoCardOffset(
    closestPromoIndex(scrollLeft, viewportWidth, cards),
    viewportWidth,
    cards,
  );
}
