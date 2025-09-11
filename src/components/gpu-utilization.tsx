'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GPUWorker {
  id: string;
  name: string;
  type: string;
  layers: number;
  location: string;
  utilization: number;
  status: 'active' | 'idle' | 'completing';
}

interface GPUUtilizationProps {
  modelName?: string;
  isVisible?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function GPUUtilization({ modelName = "Llama 3.3 70B", isVisible = true, isStreaming = false, className }: GPUUtilizationProps) {
  // Get model-specific GPU configuration
  const getModelGPUs = (modelName: string): GPUWorker[] => {
    const modelId = getModelIdFromName(modelName);
    
    switch (modelId) {
      case 'deepseek':
        return [
          {
            id: 'l40s-1', name: 'L40S-1', type: 'L40S', layers: 23,
            location: 'N Virginia', utilization: 0, status: 'idle'
          },
          {
            id: 'l40s-2', name: 'L40S-2', type: 'L40S', layers: 23,
            location: 'N California', utilization: 0, status: 'idle'
          },
          {
            id: 'l40s-3', name: 'L40S-3', type: 'L40S', layers: 22,
            location: 'Ohio', utilization: 0, status: 'idle'
          },
          {
            id: 'a10g-1', name: 'A10G-1', type: 'A10G', layers: 12,
            location: 'Ohio', utilization: 0, status: 'idle'
          }
        ];
      
      case 'qwen':
        return [
          {
            id: 'l40-1', name: 'L40-1', type: 'L40', layers: 32,
            location: 'Ohio', utilization: 0, status: 'idle'
          },
          {
            id: 'a10g-1', name: 'A10G-1', type: 'A10G', layers: 16,
            location: 'Ohio', utilization: 0, status: 'idle'
          },
          {
            id: 'a10g-2', name: 'A10G-2', type: 'A10G', layers: 16,
            location: 'Ohio', utilization: 0, status: 'idle'
          }
        ];
      
      case 'devstral':
        return [
          {
            id: 'a10g-1', name: 'A10G-1', type: 'A10G', layers: 13,
            location: 'Ohio', utilization: 0, status: 'idle'
          },
          {
            id: 'a10g-2', name: 'A10G-2', type: 'A10G', layers: 13,
            location: 'Ohio', utilization: 0, status: 'idle'
          },
          {
            id: 'l4-1', name: 'L4-1', type: 'L4', layers: 13,
            location: 'Ohio', utilization: 0, status: 'idle'
          }
        ];
      
      case 'llama':
      default:
        return [
          {
            id: 'l40-1', name: 'L40-1', type: 'L40', layers: 27,
            location: 'N Virginia', utilization: 0, status: 'idle'
          },
          {
            id: 'l40-2', name: 'L40-2', type: 'L40', layers: 27,
            location: 'N California', utilization: 0, status: 'idle'
          },
          {
            id: 'l40-3', name: 'L40-3', type: 'L40', layers: 26,
            location: 'Ohio', utilization: 0, status: 'idle'
          }
        ];
    }
  };

  // Helper to get model ID from name
  const getModelIdFromName = (name: string): string => {
    if (name.toLowerCase().includes('deepseek')) return 'deepseek';
    if (name.toLowerCase().includes('qwen')) return 'qwen';
    if (name.toLowerCase().includes('devstral')) return 'devstral';
    if (name.toLowerCase().includes('llama')) return 'llama';
    return 'llama'; // default
  };

  const [workers, setWorkers] = useState<GPUWorker[]>(() => getModelGPUs(modelName));

  // Update workers when model changes
  useEffect(() => {
    setWorkers(getModelGPUs(modelName));
  }, [modelName]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'processing' | 'completing'>('idle');
  const [currentActiveLayer, setCurrentActiveLayer] = useState<number>(-1);
  const [completedLayers, setCompletedLayers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isVisible) return;

    if (isStreaming) {
      // Start processing animation and keep it running while streaming
      setAnimationPhase('processing');
      
      // Set all workers to active (for status display)
      setWorkers(prev => prev.map(w => ({ 
        ...w, 
        status: 'active', 
        utilization: Math.random() * 80 + 20 
      })));
      
      // Function to run one complete waterfall sequence
      const runWaterfallSequence = () => {
        const totalLayers = workers.length;
        
        // Clear all completed layers when starting from layer 1 again
        setCompletedLayers(new Set());
        setCurrentActiveLayer(-1);
        
        // Cycle through each layer rapidly to sync with token streaming
        setTimeout(() => {
          for (let layerIndex = 0; layerIndex < totalLayers; layerIndex++) {
            setTimeout(() => {
              setCurrentActiveLayer(layerIndex);
              // After the layer finishes rapidly filling, mark it as completed
              setTimeout(() => {
                setCompletedLayers(prev => new Set([...prev, layerIndex]));
              }, 300); // Mark as completed 300ms after activation (rapid fill)
            }, layerIndex * 400); // Faster layer transitions (400ms between layers)
          }
        }, 50);
      };

      // Start the first sequence immediately
      runWaterfallSequence();

      // Calculate total sequence time: (number of layers * 400ms) + 400ms buffer
      const sequenceTime = (workers.length * 400) + 400;

      // Loop the waterfall animation continuously while streaming (faster cycles)
      const waterfallInterval = setInterval(() => {
        runWaterfallSequence();
      }, sequenceTime);

      // Keep updating utilization for all workers
      const updateInterval = setInterval(() => {
        setWorkers(prev => prev.map(w => ({
          ...w,
          utilization: Math.random() * 80 + 20
        })));
      }, 1000);

      return () => {
        clearInterval(waterfallInterval);
        clearInterval(updateInterval);
      };
    } else if (animationPhase === 'processing') {
      // Complete animation when streaming stops
      setAnimationPhase('completing');
      setCurrentActiveLayer(-1);
      setCompletedLayers(new Set());
      setWorkers(prev => prev.map(w => ({ ...w, status: 'completing' })));
      
      setTimeout(() => {
        setAnimationPhase('idle');
        setWorkers(prev => prev.map(w => ({ 
          ...w, 
          status: 'idle', 
          utilization: 0 
        })));
      }, 1000);
    }
  }, [isVisible, isStreaming, workers.length]);

  // Render layer visualization with waterfall effect
  const renderLayers = (worker: GPUWorker, workerIndex: number) => {
    const isActive = worker.status === 'active' || worker.status === 'completing';
    const isCurrentlyActive = currentActiveLayer === workerIndex && isStreaming;
    const isCompleted = completedLayers.has(workerIndex);
    
    // Calculate total layers for this model to get proportions
    const totalLayers = workers.reduce((sum, w) => sum + w.layers, 0);
    const totalBlocksInRow = 50; // Total blocks to show per row
    
    // Calculate blocks for this worker based on layer proportion
    const layerProportion = worker.layers / totalLayers;
    const blocksForThisWorker = Math.floor(layerProportion * totalBlocksInRow);
    
    // Calculate starting position based on previous workers
    const previousWorkerBlocks = workers.slice(0, workerIndex).reduce((sum, w) => {
      const prevProportion = w.layers / totalLayers;
      return sum + Math.floor(prevProportion * totalBlocksInRow);
    }, 0);
    
    const startBlock = previousWorkerBlocks;
    const endBlock = startBlock + blocksForThisWorker;
    
    // For the last worker, ensure we fill to the end
    const adjustedEndBlock = workerIndex === workers.length - 1 ? totalBlocksInRow : endBlock;
    
    // Create ALL blocks
    const blocks = Array.from({ length: totalBlocksInRow }, (_, i) => {
      // Check if this block should be lit by this layer
      const isThisLayerBlock = i >= startBlock && i < adjustedEndBlock;
      
      // Block is lit if: currently active OR previously completed (and not cleared)
      const isBlockLit = isThisLayerBlock && (isCurrentlyActive || isCompleted);
      
      // Rapid fill animation - each block lights up quickly in sequence
      const blockDelay = isThisLayerBlock && isCurrentlyActive ? (i - startBlock) * 20 : 0; // Fast 20ms delay
      
      return (
        <div
          key={i}
          className={cn(
            "h-2 w-2 mr-0.5 transition-all duration-100 ease-in-out", // Faster transition
            isBlockLit
              ? isCurrentlyActive
                ? "bg-blue-500 shadow-sm" // Currently active - blue
                : "bg-green-500 shadow-sm" // Previously completed - green
              : worker.status === 'completing' && isThisLayerBlock
                ? "bg-green-500 shadow-sm"
                : "bg-gray-200 dark:bg-gray-700"
          )}
          style={{
            transitionDelay: isCurrentlyActive && isThisLayerBlock ? `${blockDelay}ms` : '0ms',
          }}
        />
      );
    });

    return (
      <div className="py-2">
        <div className="flex items-center">
          {blocks}
        </div>
      </div>
    );
  };

  // Calculate total layers for the model
  const totalLayers = workers.reduce((sum, w) => sum + w.layers, 0);

  if (!isVisible) return null;

  return (
    <>
      <style jsx>{`
        @keyframes shimmer {
          0% { opacity: 0.7; transform: scaleX(1); }
          50% { opacity: 1; transform: scaleX(1.02); }
          100% { opacity: 0.7; transform: scaleX(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes waterfallPulse {
          0% { 
            opacity: 0.7; 
            transform: scaleY(1);
            background-color: #3b82f6;
          }
          25% { 
            opacity: 1; 
            transform: scaleY(1.2);
            background-color: #1d4ed8;
          }
          50% { 
            opacity: 0.8; 
            transform: scaleY(1.1);
            background-color: #2563eb;
          }
          75% { 
            opacity: 1; 
            transform: scaleY(1.3);
            background-color: #1e40af;
          }
          100% { 
            opacity: 0.7; 
            transform: scaleY(1);
            background-color: #3b82f6;
          }
        }
      `}</style>
      
      <Card className={cn("border-0 shadow-none bg-transparent", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                GPU Cluster
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {modelName} • {totalLayers} layers
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
            <span className="text-muted-foreground">GPUs</span>
            <Badge variant="secondary">{workers.length} GPUs</Badge>
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
                    <span className="font-medium">
                      {worker.name} • {worker.type}
                    </span>
                    <span className="text-muted-foreground">
                      {worker.layers} layers
                    </span>
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
                     worker.status === 'active' ? 'Processing' : 
                     'Completed'}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  {renderLayers(worker, index)}
                  {isExpanded && (
                    <div className="text-xs text-muted-foreground">
                      {worker.location} • layers {index === 0 ? '0' : workers.slice(0, index).reduce((sum, w) => sum + w.layers, 0)}-{workers.slice(0, index + 1).reduce((sum, w) => sum + w.layers, 0) - 1}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {isExpanded && (
            <div className="pt-3 border-t">
              <div className="text-xs text-muted-foreground">
                Layer distribution: {workers.map(w => `${w.layers}`).join(' + ')} = {totalLayers}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
