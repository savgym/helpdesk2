import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { UserDialog } from "../components/UserDialog";
import { UsersTable } from "../components/UsersTable";

export default function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage agent accounts and roles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New User
        </Button>
      </div>

      <UsersTable />

      <UserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
