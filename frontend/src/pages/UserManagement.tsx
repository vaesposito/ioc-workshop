import { FormEvent, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DemoLocked } from "../components/DemoLocked";
import { Layout } from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import {
  useDeleteUserMutation,
  useUpdateUserRoleMutation,
  useUsersQuery,
} from "../query/hooks/useUsersQuery";
import {
  toUserMessage,
} from "../utils/api";

type UserRole = "view" | "execute" | "admin";

interface CreateState {
  email: string;
  username: string;
  role: UserRole;
}

const INITIAL_CREATE_STATE: CreateState = {
  email: "",
  username: "",
  role: "view",
};

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const usersQuery = useUsersQuery();
  const updateUserRoleMutation = useUpdateUserRoleMutation();
  const deleteUserMutation = useDeleteUserMutation();

  const users = usersQuery.data ?? [];
  const loading = usersQuery.isLoading;
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [pendingDeleteEmail, setPendingDeleteEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateState>(
    INITIAL_CREATE_STATE,
  );

  useEffect(() => {
    if (usersQuery.error) {
      setError(toUserMessage(usersQuery.error, "generic"));
      return;
    }
    setError(null);
  }, [usersQuery.error]);

  async function onCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function onChangeRole(email: string, role: UserRole) {
    setError(null);
    try {
      await updateUserRoleMutation.mutateAsync({ email, role });
    } catch (err) {
      setError(toUserMessage(err, "generic"));
    }
  }

  async function onDeleteUser(email: string) {
    const isSelf = currentUser?.email.toLowerCase() === email.toLowerCase();
    if (isSelf) {
      setError("You cannot delete your currently authenticated account.");
      return;
    }

    setError(null);
    setDeletingEmail(email);
    try {
      await deleteUserMutation.mutateAsync(email);
    } catch (err) {
      setError(toUserMessage(err, "generic"));
    } finally {
      setDeletingEmail(null);
      setPendingDeleteEmail(null);
    }
  }

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      ),
    [users],
  );

  return (
    <Layout pageTitle="Settings / User management">
      <section className="p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User management</h1>
          <p className="mt-2 text-sm text-gray-500">
            Admin-only area to create users, update roles, and remove users.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4"
          onSubmit={onCreateUser}
        >
          <input
            required
            disabled
            type="email"
            value={createState.email}
            onChange={(event) =>
              setCreateState((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
            placeholder="Email"
          />
          <input
            required
            disabled
            value={createState.username}
            onChange={(event) =>
              setCreateState((current) => ({
                ...current,
                username: event.target.value,
              }))
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
            placeholder="Username"
          />
          <select
            disabled
            value={createState.role}
            onChange={(event) =>
              setCreateState((current) => ({
                ...current,
                role: event.target.value as UserRole,
              }))
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="view">view</option>
            <option value="execute">execute</option>
            <option value="admin">admin</option>
          </select>
          <DemoLocked align="start">
            <button
              type="submit"
              disabled
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Create user
            </button>
          </DemoLocked>
        </form>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && sortedUsers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={5}>
                    Loading users...
                  </td>
                </tr>
              )}
              {sortedUsers.map((user) => (
                <tr key={user.email} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{user.email}</td>
                  <td className="px-4 py-3 text-gray-700">{user.username}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        void onChangeRole(user.email, event.target.value as UserRole)
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="view">view</option>
                      <option value="execute">execute</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(user.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {currentUser?.email.toLowerCase() === user.email.toLowerCase() && (
                      <span className="mr-2 text-xs text-gray-500">Current user</span>
                    )}
                    <button
                      type="button"
                      disabled={
                        deletingEmail !== null ||
                        currentUser?.email.toLowerCase() === user.email.toLowerCase()
                      }
                      onClick={() => setPendingDeleteEmail(user.email)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingEmail === user.email ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ConfirmDialog
          isOpen={pendingDeleteEmail !== null}
          title="Delete user"
          message={
            pendingDeleteEmail
              ? `Delete ${pendingDeleteEmail}? This action cannot be undone.`
              : ""
          }
          confirmLabel={
            deletingEmail === pendingDeleteEmail ? "Deleting..." : "Delete"
          }
          onCancel={() => {
            if (deletingEmail === null) {
              setPendingDeleteEmail(null);
            }
          }}
          onConfirm={() => {
            if (pendingDeleteEmail !== null && deletingEmail === null) {
              void onDeleteUser(pendingDeleteEmail);
            }
          }}
        />
      </section>
    </Layout>
  );
}
