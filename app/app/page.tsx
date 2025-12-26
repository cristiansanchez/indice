"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppPage() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Client-side authentication check as additional security layer
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = sessionStorage.getItem("authenticated") === "true";
      // Also check if we can access the cookie (though it's HttpOnly, this is a fallback)
      if (!isAuth) {
        router.push("/");
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate processing for 2 seconds
    setTimeout(() => {
      setIsLoading(false);
      // Reset form or show success message here
    }, 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Cpu className="w-8 h-8 text-gray-700" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 font-serif">
            Ignite discovery
          </h1>
          <p className="text-sm text-gray-500">
            Paste text to read to start creating knowledge
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <textarea
              placeholder="Paste your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[300px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 resize-y text-sm placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              required
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isLoading || !text.trim()}
                className="px-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Reading...
                  </>
                ) : (
                  "Read"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

