import { useParams } from "react-router-dom";

export default function TicketDetailPage() {
  const { id } = useParams();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Ticket #{id}</h1>
      <p className="text-sm text-gray-500 mt-2">Ticket detail — Phase 4.</p>
    </div>
  );
}
