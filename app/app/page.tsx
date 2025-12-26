"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LearningIndexResponse, LearningModule } from "@/types/learning";

export default function AppPage() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LearningIndexResponse | null>(null);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);
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
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/process-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast.success("Learning index generated successfully!");
      } else {
        setError(data.error || "An error occurred while processing your text");
        toast.error(data.error || "Failed to process text");
      }
    } catch (err) {
      const errorMessage = "An error occurred. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;

    const formattedText = formatFullContent(result);
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopiedIndex("all");
      toast.success("All content copied to clipboard!");
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const copyModule = (module: LearningModule) => {
    const moduleText = `${module.title}\n${module.description}`;
    navigator.clipboard.writeText(moduleText).then(() => {
      setCopiedIndex(module.order);
      toast.success("Module copied to clipboard!");
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const formatFullContent = (data: LearningIndexResponse): string => {
    let content = `${data.main_topic}\n${data.topic_summary}\n\n`;
    content += "Learning Modules:\n\n";
    
    data.learning_modules.forEach((module, index) => {
      content += `${index + 1}. ${module.title}\n`;
      content += `   ${module.description}\n`;
      content += `   Difficulty: ${module.difficulty}\n`;
      content += `   Source: ${module.source_type}\n\n`;
    });

    return content;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-100 text-green-800 border-green-200";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Advanced":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSourceTypeColor = (sourceType: string) => {
    return sourceType === "Derived from Text"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-purple-100 text-purple-800 border-purple-200";
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 mt-8">
            {/* Header with Copy All Button */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {result.main_topic}
                </h2>
                <p className="text-gray-600">{result.topic_summary}</p>
              </div>
              <Button
                onClick={copyAll}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                {copiedIndex === "all" ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy All
                  </>
                )}
              </Button>
            </div>

            {/* Learning Modules */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Learning Modules
              </h3>
              {result.learning_modules
                .sort((a, b) => a.order - b.order)
                .map((module) => (
                  <Card key={module.order} className="border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-500">
                              #{module.order}
                            </span>
                            <h4 className="text-lg font-semibold text-gray-900">
                              {module.title}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600">
                            {module.description}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded border ${getDifficultyColor(
                                module.difficulty
                              )}`}
                            >
                              {module.difficulty}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded border ${getSourceTypeColor(
                                module.source_type
                              )}`}
                            >
                              {module.source_type}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => copyModule(module)}
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                        >
                          {copiedIndex === module.order ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

