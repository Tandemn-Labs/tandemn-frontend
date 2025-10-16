import { MessageSquare, Key, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SignInPromptProps {
  pageType: 'playground' | 'batch-inference' | 'api-keys';
}

export function SignInPrompt({ pageType }: SignInPromptProps) {
  const getPageConfig = () => {
    switch (pageType) {
      case 'playground':
        return {
          icon: MessageSquare,
          title: 'Sign in to Playground',
          description: 'Please sign in to start experimenting with AI models and access your conversation history.',
        };
      case 'batch-inference':
        return {
          icon: Database,
          title: 'Sign in to Batch Inference',
          description: 'Please sign in to access batch processing features and manage your inference tasks.',
        };
      case 'api-keys':
        return {
          icon: Key,
          title: 'Sign in to API Keys',
          description: 'Please sign in to manage your API keys and access programmatic features.',
        };
      default:
        return {
          icon: MessageSquare,
          title: 'Sign in Required',
          description: 'Please sign in to access this feature.',
        };
    }
  };

  const { icon: Icon, title, description } = getPageConfig();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-semibold mb-4">{title}</h2>
        <p className="text-muted-foreground mb-6">
          {description}
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
