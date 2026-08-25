import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRatingPoster } from "@/lib/ratings/poster";
import { createPortal } from "react-dom";
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Eye,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Poster } from "@/components/poster";
import { RatingStars } from "@/components/ratings/rating-stars";
import { useT } from "@/lib/i18n";
import { fetchUserRatings } from "@/lib/social/ratings-api";
import type { PublicRating, RatingCounts } from "@/lib/ratings/types";
import { timeAgo } from "@/views/profile/profile-bits";
import {
  nextRatingSort,
  sortUserRatings,
  type RatingSort,
} from "./user-ratings-sort";

const TABS: Array<{ id: string; label: string; countKey: keyof RatingCounts }> = [
  { id: "all", label: "All", countKey: "total" },
  { id: "movie", label: "Movies", countKey: "movie" },
  { id: "series", label: "TV", countKey: "series" },
  { id: "anime", label: "Anime", countKey: "anime" },
  { id: "manga", label: "Manga", countKey: "manga" },
];

const EMPTY_COUNTS: RatingCounts = { movie: 0, series: 0, anime: 0, manga: 0, total: 0 };
const VISIBLE_BATCH_SIZE = 50;

export function UserRatings({
  handle,
  alias,
  onOpenMeta,
  onClose,
}: {
  handle: string;
  alias: string;
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RatingSort>("off");
  const deferredQuery = useDeferredValue(query);
  const [items, setItems] = useState<PublicRating[]>([]);
  const [counts, setCounts] = useState<RatingCounts>(EMPTY_COUNTS);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);
  const seen = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const trimmedQuery = deferredQuery.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const needsCompleteRatings = sort !== "off";
  const visibleItems = useMemo(() => {
    const matchingItems = normalizedQuery
      ? items.filter((r) => r.title.toLowerCase().includes(normalizedQuery))
      : items;
    return sortUserRatings(matchingItems, sort);
  }, [items, normalizedQuery, sort]);
  const displayedItems = visibleItems.slice(0, visibleCount);
  const hasBufferedItems = visibleCount < visibleItems.length;

  useEffect(() => {
    const ac = new AbortController();
    const version = ++requestVersion.current;
    setLoading(true);
    setMore(false);
    setVisibleCount(VISIBLE_BATCH_SIZE);
    setItems([]);

    const fetchRatings = async () => {
      let nextCursor: string | undefined;
      const loaded: PublicRating[] = [];
      let firstCounts: RatingCounts | undefined;

      do {
        const page = await fetchUserRatings(
          handle,
          { type, cursor: nextCursor, query: trimmedQuery || undefined },
          ac.signal,
        );
        if (ac.signal.aborted || version !== requestVersion.current) return;
        firstCounts ??= page.counts;
        loaded.push(...page.items);
        nextCursor = page.nextCursor;
      } while (needsCompleteRatings && nextCursor);

      if (ac.signal.aborted || version !== requestVersion.current) return;
      setItems(loaded);
      setCursor(needsCompleteRatings ? undefined : nextCursor);
      if (!seen.current || type === "all") setCounts(firstCounts ?? EMPTY_COUNTS);
      seen.current = true;
      setLoading(false);
    };

    fetchRatings().catch(() => {
      if (!ac.signal.aborted && version === requestVersion.current) {
        setLoading(false);
      }
    });

    return () => ac.abort();
  }, [handle, type, trimmedQuery, needsCompleteRatings]);

  const loadMore = useCallback(() => {
    if (hasBufferedItems) {
      setVisibleCount((current) => current + VISIBLE_BATCH_SIZE);
      return;
    }
    if (!cursor || more) return;
    const version = requestVersion.current;
    setMore(true);
    fetchUserRatings(handle, { type, cursor, query: trimmedQuery || undefined })
      .then((page) => {
        if (version !== requestVersion.current) return;
        setItems((prev) => [...prev, ...page.items]);
        setCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (version === requestVersion.current) setMore(false);
      });
  }, [cursor, more, handle, type, trimmedQuery, hasBufferedItems]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || (!hasBufferedItems && !cursor) || more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: scrollRef.current, rootMargin: "500px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, more, hasBufferedItems, loadMore]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[130] flex items-stretch justify-center bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("Ratings")}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative m-6 flex max-h-[calc(100vh-3rem)] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl border border-edge-soft bg-surface shadow-[0_30px_120px_-30px_rgba(0,0,0,0.85)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-7 py-5">
          <h2 className="font-display text-[24px] font-medium leading-tight tracking-tight text-ink">
            {t("{name}'s ratings", { name: alias })}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="space-y-3 border-b border-edge-soft px-7 py-3">
          <div className="flex max-w-[468px] items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={14} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search ratings")}
                aria-label={t("Search ratings")}
                className="h-10 w-full rounded-full border border-edge-soft bg-surface/90 ps-11 pe-4 text-[13px] text-ink placeholder:text-ink-subtle outline-none transition-colors focus:border-edge"
              />
            </div>
            <button
              type="button"
              onClick={() => setSort((current) => nextRatingSort(current))}
              title={
                sort === "off"
                  ? t("Sort ratings")
                  : sort === "highest"
                    ? t("Highest to lowest")
                    : t("Lowest to highest")
              }
              aria-label={
                sort === "off"
                  ? t("Sort ratings: off")
                  : sort === "highest"
                    ? t("Sort ratings: highest to lowest")
                    : t("Sort ratings: lowest to highest")
              }
              aria-pressed={sort !== "off"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                sort === "off"
                  ? "border-edge-soft text-ink-muted hover:bg-elevated hover:text-ink"
                  : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
              }`}
            >
              {sort === "highest" ? (
                <ArrowDownWideNarrow size={16} strokeWidth={2.2} />
              ) : sort === "lowest" ? (
                <ArrowUpNarrowWide size={16} strokeWidth={2.2} />
              ) : (
                <ArrowUpDown size={16} strokeWidth={2.2} />
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const n = counts[tab.countKey];
              if (tab.id !== "all" && n === 0) return null;
              const active = type === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setType(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                >
                  {t(tab.label)}
                  <span className={`tabular-nums ${active ? "text-canvas/70" : "text-ink-subtle"}`}>{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={22} className="animate-spin text-ink-subtle" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-[13.5px] text-ink-muted">
              {trimmedQuery ? t('No ratings match "{query}"', { query: trimmedQuery }) : t("No ratings yet")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedItems.map((r) => (
                <RatingRow key={r.itemKey} r={r} onOpenMeta={onOpenMeta} />
              ))}
              {(hasBufferedItems || cursor) && (
                <div
                  ref={sentinelRef}
                  aria-hidden
                  className="flex h-12 items-center justify-center"
                >
                  {more && <Loader2 size={16} className="animate-spin text-ink-subtle" />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RatingRow({
  r,
  onOpenMeta,
}: {
  r: PublicRating;
  onOpenMeta?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
}) {
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const open = onOpenMeta
    ? () => onOpenMeta(r.itemKey, r.mediaType, { name: r.title, poster: r.posterUrl })
    : undefined;

  const poster = useRatingPoster(r.itemKey, r.mediaType, r.title, r.posterUrl);
  return (
    <div className="flex gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-3.5">
      <button
        type="button"
        onClick={open}
        disabled={!open}
        className="w-16 shrink-0 disabled:cursor-default"
      >
        <Poster src={poster} seed={r.title} ratio="portrait" lazy className="rounded-[8px] ring-1 ring-edge-soft" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={open}
            disabled={!open}
            className="truncate text-start text-[15px] font-semibold text-ink hover:underline disabled:cursor-default disabled:no-underline"
          >
            {r.title}
          </button>
          <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">{timeAgo(r.at)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <RatingStars value={r.score} readOnly size={14} />
          <span className="text-[12px] font-bold tabular-nums text-ink">{r.score}/10</span>
        </div>
        {r.review && (
          <div className="relative mt-2">
            <p
              className={`whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted ${
                r.spoiler && !revealed ? "select-none blur-sm" : ""
              }`}
            >
              {r.review}
            </p>
            {r.spoiler && !revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-canvas/30 text-[12px] font-semibold text-ink transition-colors hover:bg-canvas/10"
              >
                <Eye size={14} />
                {t("Show spoiler")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
