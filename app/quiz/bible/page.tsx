import { Suspense } from "react";
import MultiQuizSetup from "@/components/MultiQuizSetup";

export default function QuizBiblePage() {
  return (
    <Suspense>
      <MultiQuizSetup />
    </Suspense>
  );
}
