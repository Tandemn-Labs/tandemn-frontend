'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ThinkingModeProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export function ThinkingMode({ content, isStreaming, className }: ThinkingModeProps) {
  // Auto-collapse when thinking is finished
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  
  // Collapse automatically when streaming stops
  React.useEffect(() => {
    if (!isStreaming && content) {
      setIsExpanded(false);
    }
  }, [isStreaming, content]);

  // Show the component if we have content OR if we're actively streaming
  if (!content && !isStreaming) {
    return null;
  }

  const isFinished = !isStreaming && content;

  return (
    <div className={cn(
      "backdrop-blur-sm bg-gradient-to-r from-white/20 to-cyan-50/30 dark:from-black/20 dark:to-cyan-950/30 border border-white/30 dark:border-cyan-500/30 rounded-xl shadow-lg glass-card",
      className
    )}>
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-200 p-0 h-auto mb-2 font-medium"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Brain className="h-4 w-4" />
          <span className="text-sm">
            {isStreaming ? 'Thinking' : (isFinished ? 'Thinking Finished' : 'Thought process')}
          </span>
          {isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin ml-1" />
          )}
        </Button>
        
        {isExpanded && (
          <div className="backdrop-blur-sm bg-white/30 dark:bg-black/30 rounded-lg p-3 border border-white/20 dark:border-cyan-500/20 shadow-inner">
            <div className="text-sm text-cyan-700 dark:text-cyan-300 whitespace-pre-wrap font-mono leading-relaxed">
              {content}
              {isStreaming && (
                <span className="animate-pulse text-cyan-500 dark:text-cyan-400">▊</span>
              )}
            </div>
            {!content && isStreaming && (
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="italic">Thinking...</span>
              </div>
            )}
          </div>
        )}
        
        {!isExpanded && (
          <div className="text-xs text-cyan-600 dark:text-cyan-400 opacity-75 italic">
            {isFinished ? (
              <span className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                Thinking Finished
              </span>
            ) : content && content.length > 50 ? (
              `${content.substring(0, 50)}...`
            ) : content || 'Preparing thoughts...'}
          </div>
        )}
      </div>
    </Card>
  );
}
