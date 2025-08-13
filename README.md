# OpenRouter Clone

A polished, responsive OpenRouter-style frontend built with Next.js 15, featuring three main surfaces: Landing, Models Directory, and Chat interface, plus authentication via NextAuth.

## Features

- **Landing Page**: Hero search bar, featured models cards, and KPI tiles
- **Models Directory**: Advanced filters sidebar, list/grid view, search and sorting
- **Chat Interface**: Rooms sidebar, model switching, streaming responses, sample prompts
- **Rankings**: Model performance rankings table
- **Authentication**: NextAuth with Credentials, Google, and GitHub providers
- **Mock APIs**: Complete REST + SSE endpoints serving dummy data

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Auth**: NextAuth (JWT mode)
- **Styling**: TailwindCSS + shadcn/ui + Radix
- **State**: Zustand for client state
- **Search**: fuse.js for client-side search
- **Icons**: Lucide React
- **Data**: In-memory mock database with 500+ models

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment** (optional):
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your OAuth credentials if needed
   ```

3. **Run development server**:
   ```bash
   pnpm dev
   ```

4. **Open in browser**: http://localhost:3000

## Demo Credentials

For testing authentication:
- **Email**: demo@demo.dev
- **Password**: demo

## API Endpoints

All APIs include artificial latency for realistic feel:

- `GET /api/models` - List models with filters and pagination
- `GET /api/models/[id]` - Get single model
- `GET /api/featured` - Featured models + KPI stats
- `GET /api/rankings` - Top 100 models by usage
- `POST /api/chat/send` - SSE streaming chat endpoint
- `GET /api/chat/rooms` - List user's chat rooms
- `POST /api/chat/rooms` - Create new chat room
- `DELETE /api/chat/rooms/[id]` - Delete chat room
- `GET /api/health` - Health check

## Features Detail

### Landing Page (/)
- Hero section with search bar that redirects to chat
- Featured models cards with growth indicators
- KPI tiles showing platform statistics
- Quick action buttons for key sections

### Models Directory (/models)
- **Filters**: Input modalities, series, context length, pricing
- **Views**: List or grid layout toggle
- **Search**: Real-time filtering with debounce
- **Sorting**: By popularity, latency, price, name
- **Pagination**: Load more functionality

### Chat (/chat)
- **Rooms**: Create/delete/search chat rooms
- **Models**: Switch models per conversation
- **Streaming**: Real-time response simulation
- **Sample prompts**: Quick-start chips
- **Persistence**: Zustand + localStorage

### Authentication
- **Protected routes**: Chat requires sign-in
- **Providers**: Credentials (demo), Google, GitHub
- **Session**: JWT-based with user persistence

## File Structure

```
app/
├── layout.tsx                 # Root layout with auth
├── page.tsx                   # Landing page
├── models/page.tsx            # Models directory
├── chat/page.tsx              # Chat interface (protected)
├── rankings/page.tsx          # Rankings table
├── signin/page.tsx            # Sign-in page
├── api/                       # API routes
└── middleware.ts              # Rate limiting + auth

src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── topbar.tsx             # Navigation header
│   ├── featured-model-card.tsx
│   ├── model-filters.tsx
│   ├── model-card.tsx
│   └── badge-components.tsx   # Reusable badges/pills
├── mock/
│   ├── types.ts               # TypeScript definitions
│   ├── seed.ts                # Data generation
│   └── db.ts                  # In-memory database
├── store/
│   ├── rooms.ts               # Chat rooms state
│   └── ui.ts                  # UI preferences
└── lib/
    ├── auth.ts                # NextAuth config
    ├── utils.ts               # Utility functions
    └── zod-schemas.ts         # API validation
```

## Keyboard Shortcuts

- `/` - Focus search bar
- `⌘/` - Toggle global search
- `⌘K` - Command menu (planned)

## Data & Mocking

The app includes:
- **500+ models** across vendors (OpenAI, Anthropic, Google, etc.)
- **Realistic pricing** and performance metrics
- **Deterministic generation** from seed for consistency
- **Featured models** showcase
- **Usage statistics** and growth indicators

## Responsive Design

- **Mobile-first**: Collapsible sidebars, optimized layouts
- **Tablet**: Adapted grid layouts and navigation
- **Desktop**: Full sidebar and multi-column layouts
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Customization

- **Theme**: Light/dark mode toggle (planned)
- **Branding**: Easy logo and color customization
- **Data**: Replace mock APIs with real endpoints
- **Models**: Extend model schema and filters

## Development

The codebase follows modern React patterns:
- **Server Components** for data fetching
- **Client Components** for interactivity
- **TypeScript** throughout for type safety
- **Zustand** for predictable state management
- **Tailwind** for utility-first styling

## Production Deployment

Before deploying:
1. Set `NEXTAUTH_SECRET` in production
2. Configure OAuth credentials
3. Replace mock APIs with real data sources
4. Set up proper rate limiting
5. Configure CORS for API access

## License

MIT License - feel free to use this as a starting point for your own projects.
# tandemn-frontend
