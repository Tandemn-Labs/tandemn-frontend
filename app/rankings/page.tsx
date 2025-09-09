'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RankingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to models page
    router.replace('/models');
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Redirecting...</h1>
        <p className="text-muted-foreground">
          The rankings page has been moved to models. Redirecting you now...
        </p>
      </div>
    </div>
  );
}
