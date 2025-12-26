"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Cookie is now set by the server (HttpOnly, Secure)
        // Store in sessionStorage as backup for client-side checks
        sessionStorage.setItem("authenticated", "true");
        
        // Get redirect URL from query params or default to /app
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirect") || "/app";
        
        router.push(redirectTo);
      } else {
        setError(data.error || "Invalid password");
        setIsLoading(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-10">
          <div className="flex flex-col items-center space-y-6">
            {/* Lock Icon */}
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 font-serif">
                Private Reader
              </h1>
              <p className="text-sm text-gray-500">
                Enter password to continue
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
                  required
                  disabled={isLoading}
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600 text-center">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? "Unlocking..." : "Unlock"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
