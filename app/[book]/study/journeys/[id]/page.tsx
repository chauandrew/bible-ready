import { notFound } from "next/navigation";
import { bookMeta, eventInBook, formatCitation, journeyInBook, journeysForBook, peopleForBook, wiredBookIds } from "@/lib/content";
import JourneyExplorer, { type JourneyCharacterView, type JourneyStopView } from "@/components/JourneyExplorer";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => journeysForBook(book).map((j) => ({ book, id: j.id })));
}

export default async function JourneyPage({ params }: { params: Promise<{ book: string; id: string }> }) {
  const { book: bookId, id } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const journey = journeyInBook(bookId, id);
  if (!journey) notFound();

  const people = peopleForBook(bookId);
  const personName = (personId: string) => people.find((p) => p.id === personId)?.name ?? personId;

  const characters: JourneyCharacterView[] = journey.characters.map((c) => ({
    id: c.id,
    name: personName(c.id),
    color: c.color,
  }));

  const stops: JourneyStopView[] = journey.stops
    .map((s): JourneyStopView | null => {
      const event = eventInBook(bookId, s.eventId);
      if (!event) return null;
      return {
        id: s.id,
        order: s.order,
        place: s.place,
        lat: s.lat,
        lng: s.lng,
        locationNote: s.locationNote,
        characterIds: s.characterIds,
        eventName: event.name,
        eventSummary: event.summary,
        citation: formatCitation(event.citation),
      };
    })
    .filter((s): s is JourneyStopView => s !== null);

  return (
    <JourneyExplorer
      bookName={book.name}
      journeyName={journey.name}
      journeySummary={journey.summary}
      characters={characters}
      stops={stops}
    />
  );
}
