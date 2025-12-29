"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Loader2, Copy, Check, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LearningIndexResponse, LearningModule, EnrichedModule } from "@/types/learning";

export default function AppPage() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LearningIndexResponse | null>(null);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [openResourceMenu, setOpenResourceMenu] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichingModule, setEnrichingModule] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const menuRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const resourceMenuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const router = useRouter();

  const availableModels = [
    { value: "gemini-2.5-flash", label: "Gemini Flash 2.5", cost: 0.15 },
    { value: "deepseek-chat", label: "DeepSeek Chat V3.2", cost: 0.15 },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner V3.2", cost: 0.20 }
  ];

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuIndex !== null) {
        const menuElement = menuRefs.current.get(openMenuIndex);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuIndex(null);
        }
      }
      if (openResourceMenu !== null) {
        const menuElement = resourceMenuRefs.current.get(openResourceMenu);
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenResourceMenu(null);
        }
      }
    };

    if (openMenuIndex !== null || openResourceMenu !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuIndex, openResourceMenu]);

  const handleMenuToggle = (moduleOrder: number) => {
    setOpenMenuIndex(openMenuIndex === moduleOrder ? null : moduleOrder);
  };

  const handleMenuClose = () => {
    setOpenMenuIndex(null);
  };

  const handleMenuAction = (action: string, moduleOrder: number) => {
    if (action === "Ground") {
      const module = result?.learning_modules.find(m => m.order === moduleOrder);
      if (module) {
        handleEnrichSingleModule(module);
      }
    }
    // Placeholder for other future functionality
    console.log(`Action: ${action} for module ${moduleOrder}`);
    handleMenuClose();
  };

  const handleResourceMenuToggle = (moduleOrder: number, resourceIndex: number) => {
    const menuKey = `${moduleOrder}-${resourceIndex}`;
    setOpenResourceMenu(openResourceMenu === menuKey ? null : menuKey);
  };

  const handleResourceMenuClose = () => {
    setOpenResourceMenu(null);
  };

  const handleResourceMenuAction = (action: string, moduleOrder: number, resourceIndex: number) => {
    // Placeholder for future functionality
    console.log(`Action: ${action} for resource ${resourceIndex} in module ${moduleOrder}`);
    handleResourceMenuClose();
  };

  const handleSendToAI = async () => {
    if (!result) return;
    
    setIsEnriching(true);
    try {
      const response = await fetch("/api/enrich-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      
      const enrichedData = await response.json();
      
      if (response.ok) {
        // Actualizar los módulos con los recursos
        const updatedModules = result.learning_modules.map((module) => {
          const enriched = enrichedData.enriched_modules.find(
            (e: EnrichedModule) => e.module_title === module.title
          );
          return {
            ...module,
            resources: enriched?.resources || [],
          };
        });
        
        setResult({
          ...result,
          learning_modules: updatedModules,
        });
        
        toast.success("Resources added successfully!");
      } else {
        toast.error(enrichedData.error || "Failed to enrich modules");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleEnrichSingleModule = async (module: LearningModule) => {
    if (!result) return;
    
    setEnrichingModule(module.order);
    try {
      // Create a minimal LearningIndexResponse with only this module
      const singleModuleIndex: LearningIndexResponse = {
        main_topic: result.main_topic,
        topic_summary: result.topic_summary,
        learning_modules: [module]
      };
      
      const response = await fetch("/api/enrich-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleModuleIndex),
      });
      
      const enrichedData = await response.json();
      
      if (response.ok) {
        // Update only this specific module with resources
        const updatedModules = result.learning_modules.map((m) => {
          if (m.order === module.order) {
            const enriched = enrichedData.enriched_modules.find(
              (e: EnrichedModule) => e.module_title === module.title
            );
            return {
              ...m,
              resources: enriched?.resources || [],
            };
          }
          return m;
        });
        
        setResult({
          ...result,
          learning_modules: updatedModules,
        });
        
        toast.success(`Resources added for "${module.title}"!`);
      } else {
        toast.error(enrichedData.error || "Failed to enrich module");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setEnrichingModule(null);
    }
  };

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
        body: JSON.stringify({ text, model: selectedModel }),
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
      content += `   Difficulty: ${module.difficulty}\n\n`;
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


  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 relative">
      {/* Model Selector */}
      <div className="absolute top-2 right-2 sm:top-6 sm:right-6 z-10 max-w-[calc(100%-1rem)] sm:max-w-none">
        <label htmlFor="model-select" className="sr-only">Select LLM Model</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={isLoading}
          className="px-1.5 py-1 text-[10px] sm:text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed max-w-[140px] sm:max-w-none"
        >
          {availableModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label} - {model.cost.toFixed(2)}€
            </option>
          ))}
        </select>
      </div>
      <div className="max-w-4xl mx-auto space-y-8 pt-12 sm:pt-8">
        {/* Icon */}
        <div className="flex justify-center mt-8 sm:mt-0">
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
            Paste text to start creating knowledge
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <textarea
              placeholder="Paste your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-h-[150px] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 resize-y text-sm placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Submitting...
                  </>
                ) : (
                  "Submit"
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
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
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
                    <Card key={module.order} className="border-gray-200 relative">
                    <CardContent className="p-4 sm:p-6 relative">
                      {/* Actions container - absolutely positioned */}
                      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                        {/* Menu button */}
                        <div
                          className="relative"
                          ref={(el) => {
                            if (el) {
                              menuRefs.current.set(module.order, el);
                            } else {
                              menuRefs.current.delete(module.order);
                            }
                          }}
                        >
                          <Button
                            onClick={() => handleMenuToggle(module.order)}
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                          {/* Dropdown menu */}
                          {openMenuIndex === module.order && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <div className="py-1">
                                <button
                                  onClick={() => handleMenuAction("Delete", module.order)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => handleMenuAction("Rewrite", module.order)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  Rewrite
                                </button>
                                <button
                                  onClick={() => handleMenuAction("Add subpoints", module.order)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  Add subpoints
                                </button>
                                <button
                                  onClick={() => handleMenuAction("Zoom in", module.order)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  Zoom in
                                </button>
                                <button
                                  onClick={() => handleMenuAction("Ground", module.order)}
                                  disabled={enrichingModule === module.order || isEnriching || !result}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {enrichingModule === module.order ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>Ground (Loading...)</span>
                                    </>
                                  ) : (
                                    <span>Ground</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Copy button */}
                        <Button
                          onClick={() => copyModule(module)}
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                        >
                          {copiedIndex === module.order ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Content container - main flow */}
                      <div className="space-y-3 min-w-0 pr-16 sm:pr-20">
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
                          </div>
                          {module.resources && module.resources.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 overflow-hidden w-full max-w-full">
                              <h5 className="text-xs font-semibold text-gray-700 mb-2">Resources:</h5>
                              <div className="space-y-2 w-full max-w-full">
                                {module.resources.map((resource, idx) => {
                                  const resourceMenuKey = `${module.order}-${idx}`;
                                  return (
                                    <div
                                      key={idx}
                                      className="block p-2 sm:p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors overflow-hidden w-full max-w-full relative"
                                    >
                                      {/* Buttons - absolutely positioned */}
                                      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-200">
                                          {(resource.score * 100).toFixed(0)}%
                                        </span>
                                        {/* Resource menu button */}
                                        <div
                                          className="relative"
                                          ref={(el) => {
                                            if (el) {
                                              resourceMenuRefs.current.set(resourceMenuKey, el);
                                            } else {
                                              resourceMenuRefs.current.delete(resourceMenuKey);
                                            }
                                          }}
                                          onClick={(e) => e.preventDefault()}
                                        >
                                          <Button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleResourceMenuToggle(module.order, idx);
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0"
                                          >
                                            <MoreVertical className="w-4 h-4" />
                                          </Button>
                                          {/* Dropdown menu */}
                                          {openResourceMenu === resourceMenuKey && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                              <div className="py-1">
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleResourceMenuAction("Show raw data", module.order, idx);
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                >
                                                  Show raw data
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleResourceMenuAction("Technical Analysis", module.order, idx);
                                                  }}
                                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                >
                                                  Technical Analysis
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block pr-16 sm:pr-20"
                                      >
                                        <div className="min-w-0 overflow-hidden w-full max-w-full">
                                          <div className="font-medium text-sm text-gray-900 break-words w-full max-w-full">{resource.title}</div>
                                          <div className="text-xs text-gray-600 mt-1 break-words w-full max-w-full">{resource.content}</div>
                                          <div className="text-xs text-blue-600 mt-1 break-words break-all overflow-wrap-anywhere w-full max-w-full">{resource.url}</div>
                                        </div>
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* Send to AI Button */}
            <div className="flex justify-end mt-6">
              <Button
                onClick={handleSendToAI}
                disabled={isEnriching || !result || enrichingModule !== null}
                className="px-8"
              >
                {isEnriching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send to AI"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

