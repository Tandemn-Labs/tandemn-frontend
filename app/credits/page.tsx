'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Zap, DollarSign } from 'lucide-react';
import { CREDIT_PACKAGES } from '@/lib/credits-client';

export default function CreditsPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchCredits();
    }
  }, [isLoaded, isSignedIn]);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseCredits = async (packageId: string) => {
    setPurchasing(packageId);
    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Credits purchased successfully!');
        await fetchCredits(); // Refresh credits
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Credits</h1>
          <p className="text-muted-foreground mb-8">Please sign in to view and purchase credits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Credits</h1>
        <p className="text-muted-foreground">
          1 Credit = 1 Dollar = 1 API Call. Purchase credits to use our API services.
        </p>
      </div>

      {/* Current Balance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">{credits}</div>
              <div className="text-muted-foreground">
                <div>Credits Available</div>
                <div className="text-sm">= ${credits} worth of API calls</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Purchase Credits
          </CardTitle>
          <CardDescription>
            Select a credit package below. Each credit allows one API call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.id} className={`relative ${pkg.popular ? 'border-primary' : ''}`}>
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-4 bg-primary">
                    Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <div className="text-3xl font-bold text-primary">
                    ${pkg.price}
                  </div>
                  <CardDescription>
                    {pkg.credits} credits • {pkg.credits} API calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => purchaseCredits(pkg.id)}
                    disabled={purchasing === pkg.id}
                  >
                    {purchasing === pkg.id ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Purchasing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Purchase ${pkg.price}
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Simple Pricing
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 1 Credit = $1</li>
                <li>• 1 API Call = 1 Credit</li>
                <li>• Batch requests = 2 Credits</li>
                <li>• No hidden fees</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Usage Examples
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Chat message: 1 credit</li>
                <li>• API call: 1 credit</li>
                <li>• Batch API call: 2 credits</li>
                <li>• Credits never expire</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}