// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  nextRatingSort,
  sortUserRatings,
  type RatingSort,
} from "../src/views/ratings/user-ratings-sort.ts";

const ratings = [
  { title: "First eight", score: 8 },
  { title: "Ten", score: 10 },
  { title: "Second eight", score: 8 },
  { title: "Four", score: 4 },
];

test("rating sort cycles from off to highest, lowest, and back to off", () => {
  let sort: RatingSort = "off";
  sort = nextRatingSort(sort);
  assert.equal(sort, "highest");
  sort = nextRatingSort(sort);
  assert.equal(sort, "lowest");
  sort = nextRatingSort(sort);
  assert.equal(sort, "off");
});

test("ratings sort highest to lowest and preserve the order of ties", () => {
  assert.deepEqual(
    sortUserRatings(ratings, "highest").map((rating) => rating.title),
    ["Ten", "First eight", "Second eight", "Four"],
  );
});

test("ratings sort lowest to highest and off preserves the original order", () => {
  assert.deepEqual(
    sortUserRatings(ratings, "lowest").map((rating) => rating.title),
    ["Four", "First eight", "Second eight", "Ten"],
  );
  assert.deepEqual(sortUserRatings(ratings, "off"), ratings);
});
