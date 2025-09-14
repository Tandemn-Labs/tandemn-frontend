import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  // Check if user is authenticated and has admin privileges
  if (!user) {
    redirect('/sign-in');
  }
  
  if (!user.isAdmin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded bg-red-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Admin Panel</h1>
                <p className="text-sm text-gray-600">
                  Logged in as {user.firstName} {user.lastName} ({user.email})
                </p>
              </div>
            </div>
            <nav className="flex space-x-6">
              <a
                href="/admin"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </a>
              <a
                href="/admin/stats"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                User Stats
              </a>
              <a
                href="/admin/api-keys"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                API Keys
              </a>
              <a
                href="/admin/transactions"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Transactions
              </a>
              <a
                href="/admin/usage"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Usage Analytics
              </a>
              <a
                href="/"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to App
              </a>
            </nav>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}