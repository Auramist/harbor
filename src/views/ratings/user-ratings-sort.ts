export type RatingSort = "off" | "highest" | "lowest";

export function nextRatingSort(sort: RatingSort): RatingSort {
  if (sort === "off") return "highest";
  if (sort === "highest") return "lowest";
  return "off";
}

export function sortUserRatings<T extends { score: number }>(
  items: readonly T[],
  sort: RatingSort,
): T[] {
  if (sort === "off") return [...items];

  const direction = sort === "highest" ? -1 : 1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => direction * (a.item.score - b.item.score) || a.index - b.index)
    .map(({ item }) => item);
}
