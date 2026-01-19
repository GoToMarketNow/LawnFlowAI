import * as React from "react"
import { cn } from "../ui/utils"
import { WebInput } from "./input"
import { WebTextarea } from "./textarea"
import { WebSelect } from "./select"
import { WebButton } from "./button"
import { Eye, Code, Sparkles, Save, Send } from "lucide-react"

export interface KnowledgeArticleData {
  title: string
  category: string
  tags: string[]
  content: string
  summary: string
}

export interface WebKnowledgeBuilderProps {
  initialData?: Partial<KnowledgeArticleData>
  onSave?: (data: KnowledgeArticleData) => void
  onSubmitForReview?: (data: KnowledgeArticleData) => void
  categories?: string[]
}

const WebKnowledgeBuilder: React.FC<WebKnowledgeBuilderProps> = ({
  initialData = {},
  onSave,
  onSubmitForReview,
  categories = ["Scheduling", "Billing", "Service Issues", "General"],
}) => {
  const [viewMode, setViewMode] = React.useState<"edit" | "preview">("edit")
  const [data, setData] = React.useState<KnowledgeArticleData>({
    title: initialData.title || "",
    category: initialData.category || categories[0],
    tags: initialData.tags || [],
    content: initialData.content || "",
    summary: initialData.summary || "",
  })
  const [tagInput, setTagInput] = React.useState("")

  const handleAddTag = () => {
    if (tagInput.trim() && !data.tags.includes(tagInput.trim())) {
      setData({ ...data, tags: [...data.tags, tagInput.trim()] })
      setTagInput("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setData({ ...data, tags: data.tags.filter((t) => t !== tag) })
  }

  const handleSave = () => {
    onSave?.(data)
  }

  const handleSubmit = () => {
    onSubmitForReview?.(data)
  }

  // Simple markdown to HTML converter for preview
  const renderMarkdown = (text: string) => {
    return text
      .split("\n")
      .map((line) => {
        // Headers
        if (line.startsWith("### ")) return `<h3 class="text-lg font-semibold mt-4 mb-2">${line.slice(4)}</h3>`
        if (line.startsWith("## ")) return `<h2 class="text-xl font-semibold mt-6 mb-3">${line.slice(3)}</h2>`
        if (line.startsWith("# ")) return `<h1 class="text-2xl font-semibold mt-8 mb-4">${line.slice(2)}</h1>`
        
        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        // Italic
        line = line.replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        // Lists
        if (line.startsWith("- ")) return `<li class="ml-4">${line.slice(2)}</li>`
        
        // Code
        line = line.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">$1</code>')
        
        // Empty lines
        if (line.trim() === "") return "<br/>"
        
        return `<p class="mb-3">${line}</p>`
      })
      .join("\n")
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("edit")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                viewMode === "edit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Code className="w-4 h-4 mr-2 inline" />
              Edit
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Eye className="w-4 h-4 mr-2 inline" />
              Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <WebButton variant="secondary" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </WebButton>
            <WebButton variant="primary" size="sm" onClick={handleSubmit}>
              <Send className="w-4 h-4 mr-2" />
              Submit for Review
            </WebButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
          {/* Editor */}
          <div
            className={cn(
              "p-6 space-y-4 border-r border-border bg-card",
              viewMode === "preview" && "hidden lg:block"
            )}
          >
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <WebInput
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="Enter article title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <WebSelect
                value={data.category}
                onChange={(value) => setData({ ...data, category: value })}
                options={categories.map((cat) => ({ value: cat, label: cat }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <div className="flex gap-2 mb-2">
                <WebInput
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  placeholder="Add tag..."
                />
                <WebButton variant="secondary" size="sm" onClick={handleAddTag}>
                  Add
                </WebButton>
              </div>
              {data.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Summary</label>
              <WebTextarea
                value={data.summary}
                onChange={(e) => setData({ ...data, summary: e.target.value })}
                placeholder="Brief summary for search results..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Content
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  Markdown supported
                </span>
              </label>
              <WebTextarea
                value={data.content}
                onChange={(e) => setData({ ...data, content: e.target.value })}
                placeholder="# Heading&#10;&#10;Write your article content here...&#10;&#10;- Use **bold** and *italic*&#10;- Add `code` snippets&#10;- Create lists"
                rows={20}
                className="font-mono text-sm"
              />
            </div>

            {/* AI Suggestions */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">AI Suggestions</p>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Improve your article with AI-powered suggestions
              </p>
              <div className="flex gap-2">
                <WebButton variant="secondary" size="sm">
                  Generate Summary
                </WebButton>
                <WebButton variant="secondary" size="sm">
                  Suggest Tags
                </WebButton>
                <WebButton variant="secondary" size="sm">
                  Check Coverage
                </WebButton>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div
            className={cn(
              "p-6 bg-muted/30 overflow-auto",
              viewMode === "edit" && "hidden lg:block"
            )}
          >
            <div className="max-w-3xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-8">
                {data.title ? (
                  <h1 className="text-3xl font-semibold mb-4">{data.title}</h1>
                ) : (
                  <h1 className="text-3xl font-semibold mb-4 text-muted-foreground">
                    Untitled Article
                  </h1>
                )}

                {data.summary && (
                  <div className="bg-primary/5 border-l-4 border-primary p-4 mb-6">
                    <p className="text-sm italic">{data.summary}</p>
                  </div>
                )}

                {data.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {data.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {data.content ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
                  />
                ) : (
                  <p className="text-muted-foreground">No content yet. Start writing...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { WebKnowledgeBuilder }
