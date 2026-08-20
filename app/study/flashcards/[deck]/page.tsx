import { notFound } from "next/navigation";
import { decks, deckById, eventById } from "@/lib/content";
import FlashcardDeck from "@/components/FlashcardDeck";

export function generateStaticParams() {
  return decks.map((d) => ({ deck: d.id }));
}

export default async function DeckPage({ params }: { params: Promise<{ deck: string }> }) {
  const { deck: deckId } = await params;
  const deck = deckById.get(deckId);
  if (!deck) notFound();

  const cards = deck.cardEventIds
    .map((id) => eventById.get(id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({ front: e.name, back: `${e.summary} (${e.place})` }));

  return <FlashcardDeck title={deck.name} cards={cards} />;
}
