import { Layout } from "../components/Layout";

export function Profile() {
  return (
    <Layout pageTitle="Profile">
      <section className="p-8">
        <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
        <p className="mt-2 text-sm text-gray-500">
          Manage your account details and preferences.
        </p>
      </section>
    </Layout>
  );
}
