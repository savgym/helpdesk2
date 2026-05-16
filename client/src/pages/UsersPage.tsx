import { CreateUserDialog } from "../components/CreateUserDialog";
import { UsersTable } from "../components/UsersTable";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage agent accounts and roles.
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <UsersTable />
    </div>
  );
}
