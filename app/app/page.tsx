"use client";

import { useState, FormEvent } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AppPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
            Paste an article URL or text to read to start creating knowledge
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="Paste article URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              required
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading}
              className="px-8 w-full sm:w-auto"
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
        </form>
      </div>
    </div>
  );
}

