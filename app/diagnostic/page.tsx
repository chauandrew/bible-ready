import { dataForModule } from "@/lib/content";
import DiagnosticClient from "@/components/DiagnosticClient";

export default function DiagnosticPage() {
  const resolved = dataForModule("all")!;
  return <DiagnosticClient data={resolved.data} questions={resolved.questions} />;
}
