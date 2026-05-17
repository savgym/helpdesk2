import { TicketsTable } from "../components/TicketsTable";

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tickets</h1>
      </div>

      <TicketsTable />
    </div>
  );
}
