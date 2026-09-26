export interface PromoCardMeasure {
  left: number;
  width: number;
}

export function closestPromoIndex(
  scrollLeft: number,
  viewportWidth: number,
  cards: PromoCardMeasure[],
): number {
  if (cards.length === 0) return 0;

  const lastCard = cards[cards.length - 1];
  const maxScroll = Math.max(0, lastCard.left + lastCard.width - viewportWidth);

  if (maxScroll === 0) return 0;

  const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
  return Math.min(cards.length - 1, Math.round(progress * (cards.length - 1)));
}
