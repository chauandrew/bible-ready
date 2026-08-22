import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const BookIdSchema = z.string().regex(/^[a-z0-9-]+$/);

/** "Genesis 22:2" or "Genesis 3" (verses optional). Used on every citable item. */
export const CitationSchema = z.object({
  book: BookIdSchema,
  chapter: z.number().int().positive(),
  verses: z.string().regex(/^\d+(-\d+)?$/).optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

// ---------------------------------------------------------------------------
// Book / arcs / chapters
// ---------------------------------------------------------------------------

/**
 * "narrative"/"sparse"/"argument" books are contiguous — chapters run 1..chapterCount
 * with no gaps, and arcs are contiguous, non-overlapping ranges covering all of them.
 * "selection" books are a curated, non-contiguous subset (e.g. "the famous psalms":
 * 1, 23, 51, 100...) — chapterCount is the count of curated chapters, not a max chapter
 * number, and arcs group them thematically rather than by range. check:content applies
 * the contiguity rules only to non-"selection" books.
 */
export const CoverageDepthSchema = z.enum(["narrative", "sparse", "argument", "selection"]);

export const BookSchema = z.object({
  id: BookIdSchema,
  name: z.string(),
  /** How the book reads in a citation or a "what is X about" prompt when that
   * differs from `name` — "Psalm 23:1", not "Psalms 23:1". Defaults to `name`. */
  citationName: z.string().optional(),
  /** Wording for the questions generated from `Event.place`. Narrative books
   * ask about real locations; a "selection" book may repurpose the field (a
   * psalm's occasion, say), where "where does this happen" is nonsense. */
  placeAsk: z.string().default("Where does this happen"),
  placeMatchAsk: z.string().default("to where it happens"),
  /** Singular noun for one of this book's `Chapter` entries, used everywhere the
   * UI says "N chapter(s)" / "Chapters" / "Review chapters". Narrative and
   * "selection" books whose chapters are real Bible chapters keep the default;
   * a thematic module like `misc` (Miscellaneous), whose numbered chapters are just
   * internal indices with no single real citation (see DESIGN.md), sets this
   * to "section" instead. Plurals are formed by appending "s" at each call
   * site — keep this singular and lowercase. */
  chapterLabel: z.string().default("chapter"),
  chapterCount: z.number().int().positive(),
  coverageDepth: CoverageDepthSchema,
  arcOrder: z.array(z.string()),
  /** Off for a fully hand-curated module (e.g. Miscellaneous)
   * whose chapters don't represent real narrative content the generic
   * per-event/per-chapter templates can ask sensible questions about.
   * Suppresses generateChapterQuestions/Location/Speaker/ChapterSummary
   * (and their ambiguity checks); free-response and sequence generation are
   * unaffected, since those are already opt-in per chapter/arc. Defaults to
   * on for every real book. */
  autoGenerate: z.boolean().optional(),
});
export type Book = z.infer<typeof BookSchema>;

export const ArcSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  name: z.string(),
  startChapter: z.number().int().positive(),
  endChapter: z.number().int().positive(),
  summary: z.string(),
  /** Caps how many items a generated "put these in order" question shows
   * (see lib/generate.ts's generateSequenceQuestions). Defaults to 6 — the
   * UI's tap-to-place list gets unwieldy past that for a normal narrative
   * arc. Raise it only for an arc that IS the content being ordered (e.g.
   * "the 39 books of the Old Testament"), not a shortcut around the default. */
  sequenceLimit: z.number().int().positive().optional(),
});
export type Arc = z.infer<typeof ArcSchema>;

export const ChapterSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  number: z.number().int().positive(),
  title: z.string(),
  /** One paragraph, kept to a consistent length band across the corpus so the
   * chapter pages read consistently. Note this is *not* what the generated
   * "what is chapter N about" question offers as options — that uses `title`. */
  summary: z.string(),
  arcId: z.string(),
  eventIds: z.array(z.string()),
  /**
   * Whether this chapter is substantive enough to generate a free-response
   * "what happens in this chapter?" question (see lib/generate.ts's
   * generateFreeResponseQuestions). Defaults to false — most chapters don't
   * opt in.
   *
   * This is a deliberate do-over of `Event.notable` below: that flag was
   * meant to gate which events could be asked about, but every authored event
   * ended up `notable: true`, so it filters nothing. Rather than patch that
   * flag's meaning after the fact, this is a new, chapter-level flag with a
   * narrower, single job — "does this chapter deserve a free-response
   * question" — so it can't drift the same way. `Event.notable` is left as-is
   * (unrelated, pre-existing, out of scope for this change).
   */
  quizWorthy: z.boolean().default(false),
  /**
   * Free-response grading (see lib/grade.ts's deriveGradingTerms) matches an
   * answer against the significant words already in `title` + `summary` —
   * there's nothing to author for the common case. This is only for a
   * well-known alternate name that isn't textually present in either (e.g.
   * "Palm Sunday" for a chapter titled "The Triumphal Entry"). Most
   * quizWorthy chapters need none.
   */
  freeResponseAliases: z.array(z.string().min(1)).default([]),
  /** Overrides the generated free-response prompt ("In your own words, what
   * happens in X N?") for a chapter that isn't narrative prose — e.g. "Name
   * the twelve disciples Jesus chose." Most quizWorthy chapters need none. */
  freeResponsePrompt: z.string().optional(),
  /** Overrides deriveGradingTerms's default minTerms (see lib/grade.ts) for a
   * chapter whose grading terms are a fixed roster (the twelve disciples, the
   * twelve tribes) rather than a handful of prose keywords — "name most of a
   * list of N" needs a threshold near N, not the global default of 3. */
  freeResponseMinTerms: z.number().int().positive().optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  firstAppearance: CitationSchema,
  relations: z
    .array(z.object({ personId: z.string(), relation: z.string() }))
    .default([]),
});
export type Person = z.infer<typeof PersonSchema>;

// ---------------------------------------------------------------------------
// Events — the backbone
// ---------------------------------------------------------------------------

export const EventSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  chapter: z.number().int().positive(),
  /** Clean noun phrase, e.g. "Noah builds the ark". No trailing punctuation,
   * no "the moment when...", no leaked chapter references. */
  name: z.string(),
  /** A few-word flashcard headline, e.g. "The flood" for an event named "The
   * flood covers the whole earth" — deliberately shorter than `name` and
   * allowed to repeat across events (several chapters can share a topic).
   * Only used for flashcard display, never by the generator, so it doesn't
   * need `name`'s distinctness guarantees. Optional — only events referenced
   * by a flashcard deck need one; falls back to `name` when absent. */
  shortName: z.string().optional(),
  citation: CitationSchema,
  /** Optional on purpose — most events aren't "about" a place. Only set this
   * when the location is itself part of the narrative (arriving in Egypt,
   * crossing the Red Sea, meeting at a named site), since that's what makes
   * "where does this happen" a question worth asking. The generator skips
   * "where"/matching questions entirely for events with no place set.
   * The place must not be named in `name` — "Abram builds an altar at Shechem"
   * answers its own "where does this happen" question. */
  place: z.string().optional(),
  peopleIds: z.array(z.string()).default([]),
  /** Position within the chapter, used for sequence questions. */
  order: z.number().int().nonnegative(),
  summary: z.string(),
  notable: z.boolean().default(false),
});
export type Event = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// Quotes — short verbatim ESV text, budget-tracked
// ---------------------------------------------------------------------------

export const QuoteSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  speakerId: z.string(),
  /** Verbatim ESV text from a single verse. No ranges. Quote the *spoken words
   * only* — the narrator's "And God said to Noah," frame names the speaker and
   * hands away the answer to the generated "who says this" question. Narration
   * with no speaker in it doesn't belong here at all. */
  text: z.string(),
  citation: CitationSchema,
});
export type Quote = z.infer<typeof QuoteSchema>;

// ---------------------------------------------------------------------------
// Hand-authored thematic questions
// ---------------------------------------------------------------------------

export const AuthoredQuestionSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  category: z.enum(["theme", "arc", "covenant", "character", "argument"]),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  correctIndex: z.number().int().nonnegative(),
  citation: CitationSchema,
  /** Shown only after answering, in Study mode. Answer confirmation, not an essay. */
  explanation: z.string().optional(),
});
export type AuthoredQuestion = z.infer<typeof AuthoredQuestionSchema>;

// ---------------------------------------------------------------------------
// Flashcard decks
// ---------------------------------------------------------------------------

export const DeckSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  name: z.string(),
  cardEventIds: z.array(z.string()),
});
export type Deck = z.infer<typeof DeckSchema>;

// ---------------------------------------------------------------------------
// Whole-book content bundle (what lib/content.ts loads per book)
// ---------------------------------------------------------------------------

export const BookContentSchema = z.object({
  book: BookSchema,
  arcs: z.array(ArcSchema),
  chapters: z.array(ChapterSchema),
  people: z.array(PersonSchema),
  events: z.array(EventSchema),
  quotes: z.array(QuoteSchema),
  questions: z.array(AuthoredQuestionSchema),
  decks: z.array(DeckSchema),
});
export type BookContent = z.infer<typeof BookContentSchema>;
