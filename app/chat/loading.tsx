import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] relative">
      {/* Rooms Sidebar Skeleton */}
      <div className="w-80 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-full" />
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Chat Area Skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Model Selection Strip */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-96" />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <Skeleton className="h-6 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-80 mx-auto mb-4" />
            <Skeleton className="h-10 w-48 mx-auto" />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex items-center justify-end mb-2">
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

