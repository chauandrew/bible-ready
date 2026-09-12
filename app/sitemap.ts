import type { MetadataRoute } from "next";
import { bookMeta, journeysForBook, wiredBookIds } from "@/lib/content";

export const dynamic = "force-static";

const BASE_URL = "https://bible-ready.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["/", "/modules", "/practice", "/progress", "/qotd", "/quiz/bible", "/study/flashcards/bible"];

  const bookRoutes = wiredBookIds.flatMap((bookId) => {
    const book = bookMeta(bookId);
    const routes = [
      `/${bookId}`,
      `/${bookId}/quiz`,
      `/${bookId}/print/all`,
      `/${bookId}/study/chapters`,
      `/${bookId}/study/people`,
      `/${bookId}/study/flashcards`,
    ];
    if (book?.coverageDepth !== "selection") routes.push(`/${bookId}/chapter-quiz`);
    for (const journey of journeysForBook(bookId)) routes.push(`/${bookId}/study/journeys/${journey.id}`);
    return routes;
  });

  return [...staticRoutes, ...bookRoutes].map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
