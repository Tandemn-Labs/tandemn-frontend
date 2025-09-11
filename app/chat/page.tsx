'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Plus, MessageSquare, Settings, Send, Paperclip, Globe, Menu, X, Zap, ChevronDown, Check, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRoomsStore } from '@/store/rooms';
import { ChatRoom, Message, Model } from '@/mock/types';
import { GPUUtilization } from '@/components/gpu-utilization';
import { TandemnHealth } from '@/components/tandemn-health';

function ChatPageContent() {
  const { user, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  const initialModelId = searchParams.get('model');
  
  const {
    rooms,
    activeRoomId,
    messages,
    setRooms,
    addRoom,
    removeRoom,
    setActiveRoom,
    addMessage,
    updateMessage,
    loadMessages,
  } = useRoomsStore();

  // Custom function to handle room selection and load messages
  const handleSetActiveRoom = (roomId: string | null) => {
    setActiveRoom(roomId);
    // Load messages when room is selected
    if (roomId && !messages[roomId]) {
      loadMessages(roomId);
    }
  };

  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [inputMessage, setInputMessage] = useState(initialQuery || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showGPUUtilization, setShowGPUUtilization] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AbortController ref for cancelling streaming requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeRoom = rooms.find(room => room.id === activeRoomId);
  const roomMessages = activeRoomId ? messages[activeRoomId] || [] : [];

  // Fetch user credits
  const fetchUserCredits = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.balance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch user credits:', error);
    }
  };

  // Fetch models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models?limit=50&sort=popularity');
        const data = await response.json();
        setModels(data.items || []);
        if (data.items?.length > 0) {
          // If there's an initial model ID from URL, use that
          if (initialModelId) {
            const initialModel = data.items.find((model: Model) => model.id === initialModelId);
            if (initialModel) {
              setCurrentModel(initialModel);
              return;
            }
          }
          
          // Otherwise, prefer Llama 3.3 70B Instruct (AWQ) as the default model since it works with tandem backend
          const llamaModel = data.items.find((model: Model) => 
            model.id === 'casperhansen/llama-3.3-70b-instruct-awq' || 
            model.name.toLowerCase().includes('llama 3.3 70b instruct (awq)')
          );
          setCurrentModel(llamaModel || data.items[0]);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
    fetchUserCredits();
  }, [initialModelId]);

  // Fetch user rooms on mount
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch('/api/chat/rooms');
        const data = await response.json();
        setRooms(data.items || []);
        
        // If we have a query but no active room, create one
        if (initialQuery && data.items?.length === 0 && currentModel) {
          createNewRoom(initialQuery);
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };
    
    if (isSignedIn) {
      fetchRooms();
    }
  }, [isSignedIn, currentModel, initialQuery]);

  const createNewRoom = async (title?: string) => {
    if (!currentModel) return;
    
    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Playground with ${currentModel.name}`,
          modelId: currentModel.id,
        }),
      });
      
      const newRoom = await response.json();
      addRoom(newRoom);
      handleSetActiveRoom(newRoom.id);
      
      // If we had an initial query, send it
      if (initialQuery && title === initialQuery) {
        setTimeout(() => sendMessage(initialQuery), 100);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setRoomToDelete(roomId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chat/rooms/${roomToDelete}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete room');
      }
      
      // Remove from local state
      removeRoom(roomToDelete);
      
      // Close dialog
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
    } catch (error) {
      console.error('Failed to delete room:', error);
      // You could add a toast notification here to show error
    } finally {
      setIsDeleting(false);
    }
  };

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
        console.log('🛑 Streaming stopped by user');
      } catch (error) {
        console.log('⚠️ Error aborting request:', error);
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
        setShowGPUUtilization(false);
      }
    }
  };

  const sendMessage = async (content: string = inputMessage) => {
    if (!content.trim() || !activeRoomId || !currentModel || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      createdAt: new Date().toISOString(),
      roomId: activeRoomId,
    };

    addMessage(activeRoomId, userMessage);
    setInputMessage('');
    setIsStreaming(true);
    setShowGPUUtilization(true);

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build conversation history including the new user message
      const conversationHistory = [
        ...roomMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: content.trim() }
      ];

      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: currentModel.id,
          roomId: activeRoomId,
          messages: conversationHistory,
        }),
        signal: controller.signal, // Add abort signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          // Payment Required - insufficient credits
          const requiredCredits = errorData.requiredCredits || 0;
          const currentCredits = errorData.currentCredits || 0;
          throw new Error(`Insufficient credits: Need $${requiredCredits.toFixed(4)} but only have $${currentCredits.toFixed(4)}. Please purchase more credits.`);
        }
        throw new Error(errorData.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let assistantContent = '';
      const assistantMessageId = `msg_${Date.now()}_assistant`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        roomId: activeRoomId,
      };

      addMessage(activeRoomId, assistantMessage);

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                assistantContent += data.text;
                // Update the existing message using the new updateMessage method
                updateMessage(activeRoomId, assistantMessageId, { content: assistantContent });
              }
              if (data.done) {
                setIsStreaming(false);
                setTimeout(() => setShowGPUUtilization(false), 3000); // Hide after 3 seconds
                // Refresh user credits after successful API call
                fetchUserCredits();
                // Clean up abort controller
                abortControllerRef.current = null;
                return;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      // Check if the error is due to abort first
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 Request was cancelled by user');
        // Don't log this as an error since it's intentional
      } else {
        console.error('❌ Failed to send message:', error);
      }
      
      setIsStreaming(false);
      setShowGPUUtilization(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const samplePrompts = [
    "Explain quantum computing in simple terms",
    "Write a Python function to sort a list",
    "What are the latest trends in AI?",
    "Help me debug this code",
  ];

  // Show sign-in prompt for unauthenticated users
  if (!isSignedIn) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-4">Sign in to Playground</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in to start experimenting with AI models and access your conversation history.
          </p>
          <Button asChild className="w-full">
            <a href="/sign-in">
              Sign In
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] relative">
      {/* Mobile Sidebar Toggle */}
      <button
        className="md:hidden fixed top-16 left-4 z-50 p-2 bg-background border rounded-md shadow-sm"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Rooms Sidebar */}
      <div className={`w-80 border-r bg-muted/10 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed md:relative z-40 md:z-auto h-full md:h-auto`}>
        <div className="p-4 border-b">
          <Button 
            onClick={() => createNewRoom()} 
            className="w-full"
            disabled={!currentModel}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {rooms.map((room) => (
                <Card
                  key={room.id}
                  className={`group cursor-pointer transition-colors hover:bg-muted/50 ${
                    activeRoomId === room.id ? 'bg-muted' : ''
                  }`}
                  onClick={(e) => {
                    // Don't select room if clicking on delete button
                    if ((e.target as HTMLElement).closest('[data-delete-button]')) {
                      return;
                    }
                    handleSetActiveRoom(room.id);
                    setIsSidebarOpen(false);
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm line-clamp-1">
                        {room.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(room.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      data-delete-button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 ml-2"
                      onClick={() => handleDeleteRoom(room.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex md:ml-0">
        {/* Chat Column */}
        <div className="flex-1 flex flex-col">
          {activeRoom ? (
            <>
              {/* Model Selection Strip */}
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium">Model:</span>
                    <Select
                      value={currentModel?.id || ''}
                      onValueChange={(modelId) => {
                        const selectedModel = models.find(m => m.id === modelId);
                        if (selectedModel) {
                          setCurrentModel(selectedModel);
                        }
                      }}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="min-w-[320px] max-w-[600px] w-auto">
                        <SelectValue placeholder="Select a model">
                          {currentModel ? (
                            <div className="flex items-center space-x-2 w-full">
                              <span className="font-medium truncate flex-shrink-0">{currentModel.name}</span>
                              <div className="flex space-x-1 flex-shrink-0">
                                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                  In: ${currentModel.promptPrice.toFixed(3)}
                                </Badge>
                                <Badge variant="outline" className="text-xs whitespace-nowrap">
                                  Out: ${currentModel.completionPrice.toFixed(3)}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            'Loading models...'
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="min-w-[320px] max-w-[600px]">
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center justify-between w-full min-w-0">
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <span className="font-medium truncate flex-shrink-0">{model.name}</span>
                                <div className="flex space-x-1 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                    In: ${model.promptPrice.toFixed(3)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                                    Out: ${model.completionPrice.toFixed(3)}
                                  </Badge>
                                </div>
                              </div>
                              {currentModel?.id === model.id && (
                                <Check className="h-4 w-4 ml-2 flex-shrink-0" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Settings button - commented out as requested */}
                  {/* <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button> */}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {roomMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with {currentModel?.name}</p>
                </div>
              ) : (
                roomMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                        {isStreaming && message.role === 'assistant' && (
                          <span className="animate-pulse">▊</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              {roomMessages.length === 0 && (
                <div className="mb-4 opacity-80">
                  <p className="text-sm text-muted-foreground mb-2">Try these prompts:</p>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => setInputMessage(prompt)}
                        className="text-xs opacity-80 hover:opacity-100"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Model Display - Credits removed */}
              <div className="flex items-center justify-end mb-2 px-1">
                <div className="text-xs text-muted-foreground">
                  {currentModel && `Using ${currentModel.name}`}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row md:items-end space-y-2 md:space-y-0 md:space-x-2">
                <div className="flex-1">
                  {/* <div className="flex items-center space-x-2 mb-2">
                    <Button variant="ghost" size="sm">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Globe className="h-4 w-4" />
                    </Button>
                  </div> */}
                  <div className="flex space-x-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isStreaming}
                      className="min-h-[40px] md:min-h-[40px] flex-1"
                    />
                    {isStreaming ? (
                      <Button 
                        type="button" 
                        onClick={stopStreaming}
                        size="icon"
                        variant="destructive"
                        className="h-10 w-10 md:h-9 md:w-9"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button 
                        type="submit" 
                        disabled={!inputMessage.trim()}
                        size="icon"
                        className="h-10 w-10 md:h-9 md:w-9"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Playground</h2>
              <p className="text-muted-foreground mb-4">
                Create a new conversation to get started
              </p>
              <Button onClick={() => createNewRoom()} disabled={!currentModel}>
                <Plus className="h-4 w-4 mr-2" />
                New Conversation
              </Button>
            </div>
          </div>
        )}
        </div>

        {/* GPU Utilization Panel - Hidden on mobile */}
        {showGPUUtilization && activeRoom && (
          <div className="w-96 border-l bg-muted/5 p-4 hidden lg:block">
            <GPUUtilization 
              modelName={currentModel?.name}
              isVisible={showGPUUtilization}
              isStreaming={isStreaming}
            />
          </div>
        )}

        {/* Tandemn Health Panel - Hidden on mobile */}
        {/* {!showGPUUtilization && (
          <div className="w-96 border-l bg-muted/5 p-4 hidden lg:block">
            <TandemnHealth />
          </div>
        )} */}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone and all messages in this conversation will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setRoomToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteRoom}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
