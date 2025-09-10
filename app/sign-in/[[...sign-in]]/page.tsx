import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="min-h-screen flex bg-black">
      {/* Left Side - Image */}
      <div className="flex-1 hidden lg:flex items-center justify-center p-8">
        <div className="max-w-2xl">
          <img 
            src="/cute-logo-1.png" 
            alt="Tandemn AI Platform" 
            className="w-96 h-96 object-contain mx-auto mb-8 gentle-float"
          />
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4 gradient-text">Welcome to Tandemn</h1>
            <p className="text-xl text-gray-300">
              The unified interface for AI models. Access the world's best AI through a single API.
            </p>
          </div>
        </div>
      </div>
      
      {/* Right Side - Sign In */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <SignIn />
        </div>
      </div>
    </div>
  );
}