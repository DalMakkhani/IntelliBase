import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { documentsAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

const FileUploadDialog = ({ open, onOpenChange, onUploadComplete }: FileUploadDialogProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [collectionType, setCollectionType] = useState<"main" | "isolated">("main");
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length !== selectedFiles.length) {
      toast({
        title: "⚠️ Invalid files",
        description: "Only PDF files are supported",
        variant: "destructive",
        className: "border-terminal-red",
      });
    }

    setFiles((prev) => [...prev, ...pdfFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "⚠️ No files selected",
        description: "Please select at least one PDF file",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    if (collectionType === "isolated" && !collectionName.trim()) {
      toast({
        title: "⚠️ Collection name required",
        description: "Please enter a name for the isolated collection",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Simulate progress (since we can't track actual upload progress easily with axios)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 300);

      await documentsAPI.upload({
        files,
        collection_type: collectionType,
        collection_name: collectionType === "isolated" ? collectionName : undefined,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: "✓ Upload successful",
        description: `${files.length} document(s) uploaded and processing`,
        className: "border-terminal-green",
      });

      // Reset state
      setTimeout(() => {
        setFiles([]);
        setCollectionType("main");
        setCollectionName("");
        setUploadProgress(0);
        setUploading(false);
        onOpenChange(false);
        if (onUploadComplete) {
          onUploadComplete();
        }
      }, 1000);
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({
        title: "✗ Upload failed",
        description: error.response?.data?.detail || "Failed to upload documents",
        variant: "destructive",
        className: "border-terminal-red",
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card terminal-border backdrop-blur-lg max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            <span className="text-foreground">Upload</span>{" "}
            <span className="text-primary">Documents</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Upload PDF files to your knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Selection */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full terminal-border"
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              Select PDF Files
            </Button>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 glass-card terminal-border text-sm overflow-hidden"
                >
                  <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap flex-1" title={file.name}>
                    {file.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 flex-shrink-0 ml-auto"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Collection Type */}
          <div className="space-y-2">
            <Label className="text-sm">Collection Type</Label>
            <RadioGroup
              value={collectionType}
              onValueChange={(value) => setCollectionType(value as "main" | "isolated")}
              disabled={uploading}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="main" id="main" />
                <Label htmlFor="main" className="text-sm font-normal cursor-pointer">
                  Main Corpus (shared knowledge base)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="isolated" id="isolated" />
                <Label htmlFor="isolated" className="text-sm font-normal cursor-pointer">
                  Isolated Collection (separate topic)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Collection Name (if isolated) */}
          {collectionType === "isolated" && (
            <div className="space-y-2">
              <Label htmlFor="collection-name" className="text-sm">
                Collection Name
              </Label>
              <Input
                id="collection-name"
                placeholder="e.g., 'Project Alpha', 'Research Papers'"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                disabled={uploading}
                className="terminal-border bg-glass-bg"
              />
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 terminal-border"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-terminal-green to-green-600 terminal-border"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadDialog;