'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Plus, MessageSquare, Settings, Send, Paperclip, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRoomsStore } from '@/store/rooms';
import { ChatRoom, Message, Model } from '@/mock/types';
import { GPUUtilization } from '@/components/gpu-utilization';

export default function ChatPage() {
  const { user, isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');
  
  const {
    rooms,
    activeRoomId,
    messages,
    setRooms,
    addRoom,
    setActiveRoom,
    addMessage,
    updateMessage,
  } = useRoomsStore();

  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [inputMessage, setInputMessage] = useState(initialQuery || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showGPUUtilization, setShowGPUUtilization] = useState(false);

  const activeRoom = rooms.find(room => room.id === activeRoomId);
  const roomMessages = activeRoomId ? messages[activeRoomId] || [] : [];

  // Fetch models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models?limit=10&sort=popularity');
        const data = await response.json();
        setModels(data.items || []);
        if (data.items?.length > 0) {
          setCurrentModel(data.items[0]);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, []);

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
          title: title || `Chat with ${currentModel.name}`,
          modelId: currentModel.id,
        }),
      });
      
      const newRoom = await response.json();
      addRoom(newRoom);
      setActiveRoom(newRoom.id);
      
      // If we had an initial query, send it
      if (initialQuery && title === initialQuery) {
        setTimeout(() => sendMessage(initialQuery), 100);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
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

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: currentModel.id,
          messages: [{ role: 'user', content: content.trim() }],
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

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
                setTimeout(() => setShowGPUUtilization(false), 2000); // Hide after 2 seconds
                return;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setShowGPUUtilization(false);
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Rooms Sidebar */}
      <div className="w-80 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <Button 
            onClick={() => createNewRoom()} 
            className="w-full"
            disabled={!currentModel}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
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
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    activeRoomId === room.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setActiveRoom(room.id)}
                >
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-1">
                      {room.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(room.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex">
        {/* Chat Column */}
        <div className="flex-1 flex flex-col">
          {activeRoom ? (
            <>
              {/* Model Tab Strip */}
              <div className="border-b p-4">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="px-3 py-1">
                    {currentModel?.name || 'Loading...'}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
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
                      className={`max-w-[80%] p-3 rounded-lg ${
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
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">Try these prompts:</p>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        onClick={() => setInputMessage(prompt)}
                        className="text-xs"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="flex items-end space-x-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Button variant="ghost" size="sm">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Globe className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={isStreaming}
                    className="min-h-[40px]"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={!inputMessage.trim() || isStreaming}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
              <p className="text-muted-foreground mb-4">
                Create a new conversation to get started
              </p>
              <Button onClick={() => createNewRoom()} disabled={!currentModel}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          </div>
        )}
        </div>

        {/* GPU Utilization Panel */}
        {showGPUUtilization && activeRoom && (
          <div className="w-96 border-l bg-muted/5 p-4">
            <GPUUtilization 
              modelName={currentModel?.name}
              isVisible={showGPUUtilization}
            />
          </div>
        )}
      </div>
    </div>
  );
}
