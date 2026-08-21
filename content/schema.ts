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
   * a thematic module like `famous-12s`, whose numbered chapters are just
   * internal indices with no single real citation (see DESIGN.md), sets this
   * to "section" instead. Plurals are formed by appending "s" at each call
   * site — keep this singular and lowercase. */
  chapterLabel: z.string().default("chapter"),
  chapterCount: z.number().int().positive(),
  coverageDepth: CoverageDepthSchema,
  arcOrder: z.array(z.string()),
});
export type Book = z.infer<typeof BookSchema>;

export const ArcSchema = z.object({
  id: z.string(),
  book: BookIdSchema,
  name: z.string(),
  startChapter: z.number().int().positive(),
  endChapter: z.number().int().positive(),
  summary: z.string(),
});
export type Arc = z.infer<typeof ArcSchema>;

/**
 * Grading data for the free-response "what happens in this chapter" question
 * (see QuizRunner's FreeResponseQuestion). Each entry in `keywordGroups` is one
 * concept the answer should touch (a subject, an action, an object...); any
 * keyword within a group counts as that concept being covered — they're
 * synonyms/near-paraphrases of each other, not separate concepts. An answer is
 * graded correct once it covers `minGroups` of the groups, so a paraphrase
 * that skips a minor detail still passes. See lib/grade.ts for the matcher.
 */
export const ChapterGradingSchema = z.object({
  keywordGroups: z.array(z.array(z.string().min(1)).min(1)).min(2),
  /** How many distinct groups a free-text answer must cover to be marked
   * correct. Must be between 1 and keywordGroups.length (checked in
   * scripts/check-content.ts, since it's a cross-field rule zod alone won't
   * express cleanly). */
  minGroups: z.number().int().positive(),
});
export type ChapterGrading = z.infer<typeof ChapterGradingSchema>;

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
  /** Required when quizWorthy is true (checked in scripts/check-content.ts).
   * Absent otherwise — a chapter that isn't asked about shouldn't carry
   * grading data nobody reads. */
  freeResponse: ChapterGradingSchema.optional(),
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
