import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatRoom, Message } from '@/mock/types';

interface RoomsState {
  rooms: ChatRoom[];
  activeRoomId: string | null;
  messages: Record<string, Message[]>;
  
  // Actions
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (room: ChatRoom) => void;
  removeRoom: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (roomId: string, message: Message) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  clearMessages: (roomId: string) => void;
}

export const useRoomsStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      rooms: [],
      activeRoomId: null,
      messages: {},
      
      setRooms: (rooms) => set({ rooms }),
      
      addRoom: (room) => set((state) => ({
        rooms: [room, ...state.rooms],
      })),
      
      removeRoom: (roomId) => set((state) => ({
        rooms: state.rooms.filter(room => room.id !== roomId),
        activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId,
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([id]) => id !== roomId)
        ),
      })),
      
      setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
      
      addMessage: (roomId, message) => set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: [...(state.messages[roomId] || []), message],
        },
      })),
      
      updateMessage: (roomId, messageId, updates) => set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: (state.messages[roomId] || []).map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      })),
      
      setMessages: (roomId, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: messages,
        },
      })),
      
      clearMessages: (roomId) => set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: [],
        },
      })),
    }),
    {
      name: 'chat-rooms',
      partialize: (state) => ({
        rooms: state.rooms,
        activeRoomId: state.activeRoomId,
        messages: state.messages,
      }),
    }
  )
);
