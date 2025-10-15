import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, ChevronLeft } from "lucide-react";
import { documentsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const Documents = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [collectionType, setCollectionType] = useState<"main" | "isolated">("main");
  const [collectionName, setCollectionName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.list();
      setDocuments(response.documents || []);
    } catch (error: any) {
      console.error("Load documents error:", error);
      toast({
        title: "✗ Failed to load documents",
        description: error.response?.data?.detail || "Please try again",
        variant: "destructive",
        className: "border-terminal-red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      setUploadDialogOpen(true);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (collectionType === "isolated" && !collectionName.trim()) {
      toast({
        title: "✗ Collection name required",
        description: "Please enter a name for the isolated collection",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    setUploading(true);
    setUploadDialogOpen(false);

    try {
      console.log("Uploading files:", {
        fileCount: selectedFiles.length,
        collectionType,
        collectionName,
        files: selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });

      const result = await documentsAPI.upload({
        files: selectedFiles,
        collection_type: collectionType,
        collection_name: collectionType === "isolated" ? collectionName : undefined,
      });

      console.log("Upload result:", result);

      toast({
        title: "✓ Upload started",
        description: `Uploading ${selectedFiles.length} document(s)...`,
        className: "border-terminal-green",
      });

      // Reload documents after a delay to see the new ones
      setTimeout(() => {
        loadDocuments();
      }, 2000);
    } catch (error: any) {
      console.error("Upload error:", error);
      console.error("Error response:", error.response);
      console.error("Error details:", error.response?.data);
      
      toast({
        title: "✗ Upload failed",
        description: error.response?.data?.detail || error.message || "Please try again",
        variant: "destructive",
        className: "border-terminal-red",
      });
    } finally {
      setUploading(false);
      setSelectedFiles([]);
      setCollectionName("");
      setCollectionType("main");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (documentId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      await documentsAPI.delete(documentId);
      toast({
        title: "✓ Document deleted",
        description: `${filename} removed successfully`,
        className: "border-terminal-green",
      });
      loadDocuments();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "✗ Delete failed",
        description: error.response?.data?.detail || "Please try again",
        variant: "destructive",
        className: "border-terminal-red",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="glass-card terminal-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {"> Add to Knowledge Base"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              {selectedFiles.length} file(s) selected
            </div>
            <RadioGroup value={collectionType} onValueChange={(v: any) => setCollectionType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="main" id="main" />
                <Label htmlFor="main" className="cursor-pointer">
                  Main Corpus (merge with existing)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="isolated" id="isolated" />
                <Label htmlFor="isolated" className="cursor-pointer">
                  New Collection (isolated)
                </Label>
              </div>
            </RadioGroup>
            {collectionType === "isolated" && (
              <div className="space-y-2">
                <Label htmlFor="collection-name">Collection Name</Label>
                <Input
                  id="collection-name"
                  placeholder="> collection_name"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setUploadDialogOpen(false)}
              className="terminal-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={collectionType === "isolated" && !collectionName.trim()}
              className="bg-gradient-to-r from-primary to-purple-700 terminal-border"
            >
              {"> Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="border-b terminal-border glass-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/chat">
              <Button variant="ghost" size="icon" className="terminal-border">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                <FileText className="inline w-6 h-6 mr-2 text-primary" />
                My Documents
              </h1>
              <div className="text-xs text-muted-foreground mt-1">
                ════════════════
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Actions */}
        <div className="mb-8">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform"
          >
            <Upload className="w-4 h-4 mr-2" />
            <span className="terminal-prompt">
              {uploading ? "Uploading..." : "Upload Documents"}
            </span>
          </Button>
        </div>

        {/* Documents Grid */}
        {loading ? (
          <div className="text-center text-terminal-green font-mono animate-pulse">
            [●○○] Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{"> No documents yet"}</p>
            <p className="text-sm">Upload PDFs to get started</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc: any, index: number) => {
              const isProcessing = doc.status === "pending" || doc.status === "processing";
              const daysLeft = doc.days_left || 0;
              
              return (
                <div
                  key={doc.document_id}
                  className="glass-card p-6 hover:border-primary/50 transition-all animate-terminal-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Document Icon/Progress */}
                  <div className="relative w-24 h-32 mx-auto mb-4">
                    <div
                      className={`w-full h-full flex items-center justify-center rounded-lg terminal-border ${
                        !isProcessing
                          ? "bg-primary/20"
                          : "bg-muted/20 opacity-30"
                      }`}
                    >
                      <FileText
                        className={`w-12 h-12 ${
                          !isProcessing ? "text-primary" : "text-muted"
                        }`}
                      />
                    </div>

                    {/* Processing Indicator */}
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs text-terminal-yellow font-mono animate-pulse">
                            Processing...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Document Info */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm truncate" title={doc.filename}>
                      {doc.filename}
                    </h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span>{formatFileSize(doc.size_bytes || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uploaded:</span>
                        <span>{formatDate(doc.upload_date)}</span>
                      </div>
                      {doc.chunk_count > 0 && (
                        <div className="flex justify-between">
                          <span>Chunks:</span>
                          <span>{doc.chunk_count}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Expires:</span>
                        <span
                          className={
                            daysLeft < 7
                              ? "text-terminal-yellow"
                              : "text-terminal-green"
                          }
                        >
                          {daysLeft} days
                        </span>
                      </div>
                      {doc.collection_name && (
                        <div className="flex justify-between">
                          <span>Collection:</span>
                          <span className="text-primary">{doc.collection_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t terminal-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.document_id, doc.filename)}
                      disabled={isProcessing}
                      className="w-full terminal-border text-terminal-red hover:bg-terminal-red/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
