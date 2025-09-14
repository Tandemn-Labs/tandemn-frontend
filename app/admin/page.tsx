import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage users, credits, and view system statistics
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">📊</span>
              </div>
              <span>User Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              View all user credit balances, transaction history, and activity statistics.
            </p>
            <Link href="/admin/stats">
              <Button className="w-full">
                View Stats
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">🔑</span>
              </div>
              <span>API Keys Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              View and manage all user API keys, monitor usage, and deactivate keys as needed.
            </p>
            <Link href="/admin/api-keys">
              <Button className="w-full">
                Manage API Keys
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">📈</span>
              </div>
              <span>Transaction Analytics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Analyze transaction patterns, revenue metrics, and model usage across all users.
            </p>
            <Link href="/admin/transactions">
              <Button className="w-full">
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">📊</span>
              </div>
              <span>Usage Analytics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Track token usage, API call counts, and spending patterns for each user.
            </p>
            <Link href="/admin/usage">
              <Button className="w-full">
                View Usage Data
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="text-yellow-600 text-xl">⚠️</div>
          <div>
            <h3 className="font-medium text-yellow-800">Admin Access Required</h3>
            <p className="text-yellow-700 text-sm mt-1">
              This admin panel is only accessible to users with admin privileges. 
              All actions are logged and monitored for security purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}