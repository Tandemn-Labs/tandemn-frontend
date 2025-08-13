'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GPUWorker {
  id: string;
  name: string;
  location: string;
  utilization: number;
  blocks: number;
  status: 'active' | 'idle' | 'completing';
}

interface GPUUtilizationProps {
  modelName?: string;
  isVisible?: boolean;
  className?: string;
}

export function GPUUtilization({ modelName = "GPT OSS 120B", isVisible = true, className }: GPUUtilizationProps) {
  const [workers, setWorkers] = useState<GPUWorker[]>([
    {
      id: 'rtx-4090-1',
      name: 'RTX 4090',
      location: 'Ondocho-takasu, Japan',
      utilization: 0,
      blocks: 24,
      status: 'idle'
    },
    {
      id: 'rtx-4090-2', 
      name: 'RTX 4090',
      location: 'Yotsukaido, Japan',
      utilization: 0,
      blocks: 24,
      status: 'idle'
    },
    {
      id: 'rtx-4090-3',
      name: 'RTX 4090', 
      location: 'Tokyo, Japan',
      utilization: 0,
      blocks: 24,
      status: 'idle'
    },
    {
      id: 'rtx-4090-4',
      name: 'RTX 4090',
      location: 'Gohongi, Japan', 
      utilization: 0,
      blocks: 24,
      status: 'idle'
    }
  ]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'processing' | 'completing'>('idle');

  useEffect(() => {
    if (!isVisible) return;

    // Start animation sequence when component becomes visible
    const startAnimation = () => {
      setAnimationPhase('processing');
      
      // Animate workers sequentially
      workers.forEach((worker, index) => {
        setTimeout(() => {
          setWorkers(prev => prev.map((w, i) => 
            i === index 
              ? { ...w, status: 'active', utilization: Math.random() * 80 + 20 }
              : w
          ));
        }, index * 200);
      });

      // Complete animation after processing
      setTimeout(() => {
        setAnimationPhase('completing');
        setWorkers(prev => prev.map(w => ({ ...w, status: 'completing' })));
        
        setTimeout(() => {
          setAnimationPhase('idle');
          setWorkers(prev => prev.map(w => ({ 
            ...w, 
            status: 'idle', 
            utilization: 0 
          })));
        }, 1000);
      }, 3000);
    };

    startAnimation();
  }, [isVisible]);

  // Animate individual blocks
  const renderBlocks = (worker: GPUWorker) => {
    const blocks = Array.from({ length: worker.blocks }, (_, i) => {
      const isActive = i < Math.floor((worker.utilization / 100) * worker.blocks);
      const delay = i * 50; // Stagger animation
      
      return (
        <div
          key={i}
          className={cn(
            "w-3 h-4 transition-all duration-300 ease-in-out",
            isActive 
              ? worker.status === 'active' 
                ? "bg-blue-500 shadow-lg shadow-blue-500/50" 
                : worker.status === 'completing'
                ? "bg-green-500 shadow-lg shadow-green-500/50"
                : "bg-gray-200 dark:bg-gray-700"
              : "bg-gray-200 dark:bg-gray-700"
          )}
          style={{
            transitionDelay: `${delay}ms`,
            animation: isActive && worker.status === 'active' 
              ? `pulse 1.5s infinite ${delay}ms` 
              : undefined
          }}
        />
      );
    });

    return (
      <div className="flex gap-1 flex-wrap">
        {blocks}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      
      <Card className={cn("border-0 shadow-none bg-transparent", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Inference Backend</CardTitle>
              <CardDescription className="text-xs mt-1">
                Model: {modelName}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Workers</span>
            <Badge variant="secondary">{workers.length}</Badge>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Worker Status</span>
              <Badge 
                variant={animationPhase === 'processing' ? 'default' : 'secondary'}
                className={cn(
                  "transition-colors duration-300",
                  animationPhase === 'processing' && "bg-blue-500",
                  animationPhase === 'completing' && "bg-green-500"
                )}
              >
                {animationPhase === 'idle' ? 'Idle' : 
                 animationPhase === 'processing' ? 'Processing' : 'Completed'}
              </Badge>
            </div>
            
            {workers.map((worker, index) => (
              <div key={worker.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{worker.name} ({worker.blocks}GB)</span>
                    <span className="text-muted-foreground">{worker.location}</span>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs transition-colors duration-300",
                      worker.status === 'active' && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                      worker.status === 'completing' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    )}
                  >
                    {worker.status === 'idle' ? 'Idle' :
                     worker.status === 'active' ? `${Math.round(worker.utilization)}%` : 
                     'Completed'}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  {renderBlocks(worker)}
                  {isExpanded && (
                    <div className="text-xs text-muted-foreground">
                      served {Math.floor(Math.random() * 400 + 100)} blocks
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {isExpanded && (
            <div className="pt-3 border-t space-y-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Total Memory</span>
                  <div className="font-medium">{workers.length * 24}GB</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Utilization</span>
                  <div className="font-medium">
                    {Math.round(workers.reduce((sum, w) => sum + w.utilization, 0) / workers.length)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
