'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThinkingModeProps {
  content: string;
  isStreaming: boolean;
  isFinished?: boolean;
  className?: string;
}

export function ThinkingMode({ content, isStreaming, isFinished = false, className }: ThinkingModeProps) {
  // Auto-collapse when thinking is finished
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  
  // Debug logging to track content updates
  React.useEffect(() => {
    if (isStreaming && content) {
      console.log('🧠 THINKING COMPONENT UPDATE:', content.length, 'chars');
    }
  }, [content, isStreaming]);
  
  // Collapse automatically when thinking finishes (but keep component visible)
  React.useEffect(() => {
    if (isFinished) {
      console.log('🧠 THINKING FINISHED - Auto-collapsing...');
      setIsExpanded(false);
    }
  }, [isFinished]);

  // Show the component if we have content OR if we're actively streaming OR if thinking finished
  // Also show if we're in streaming mode (even with empty content initially)
  if (!content && !isStreaming && !isFinished) {
    return null;
  }

  return (
    <div className={cn(
      "backdrop-blur-md bg-gradient-to-r from-gray-900/40 to-slate-800/50 border border-white/20 rounded-xl shadow-2xl glass-card",
      className
    )}>
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-white/90 hover:text-white p-0 h-auto mb-2 font-medium"
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
          {isStreaming && !isFinished && (
            <Loader2 className="h-3 w-3 animate-spin ml-1" />
          )}
        </Button>
        
        {isExpanded && (
          <div className="backdrop-blur-sm bg-black/20 rounded-lg p-3 border border-white/10 shadow-inner">
            <div className="text-sm text-white whitespace-pre-wrap font-mono leading-relaxed">
              {content}
              {isStreaming && (
                <span className="animate-pulse text-white/80">▊</span>
              )}
            </div>
            {(!content || content.trim() === '') && isStreaming && (
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="italic">Thinking...</span>
              </div>
            )}
          </div>
        )}
        
        {!isExpanded && (
          <div className="text-xs text-white/70 italic">
            {isFinished || (!isStreaming && content) ? (
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
    </div>
  );
}
