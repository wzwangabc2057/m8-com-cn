'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Upload, Copy, Trash2, Check, File as FileIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export function AssetManager() {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/assets?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return (res.data.assets || []) as any[];
    },
    enabled: !!siteId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // Use original filename but prepend timestamp to avoid collisions if needed, 
      // or just use filename. Here we keep it simple.
      formData.append('filename', file.name);
      
      await axios.post(`/api/assets?siteId=${siteId}`, formData, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', siteId] });
      setUploading(false);
      toast({ title: 'Success', description: 'File uploaded successfully' });
    },
    onError: () => {
      setUploading(false);
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!confirm('Are you sure you want to delete this file?')) return;
      await axios.delete(`/api/assets?siteId=${siteId}&key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', siteId] });
      toast({ title: 'Deleted', description: 'File deleted successfully' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setUploading(true);
      uploadMutation.mutate(e.target.files[0]);
      // Reset input
      e.target.value = '';
    }
  };

  const copyToClipboard = (url: string, key: string) => {
    // Determine the public URL. Currently using proxy URL, 
    // but in production this should probably be the R2 public domain if configured.
    // For now, we use the relative proxy URL or full URL if available.
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Copied', description: 'URL copied to clipboard' });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Loading library...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Media Library</h2>
          <p className="text-muted-foreground">Manage images and files for your site.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button disabled={uploading} className="relative overflow-hidden">
             {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
             Upload File
             <Input 
               type="file" 
               className="absolute inset-0 opacity-0 cursor-pointer" 
               onChange={handleFileChange}
               disabled={uploading}
             />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {assets?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
            No files found. Upload some to get started.
          </div>
        )}
        
        {assets?.map((asset) => {
          const fileName = asset.key.split('/').pop();
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
          
          return (
            <Card key={asset.key} className="group relative overflow-hidden border bg-background hover:shadow-md transition-all">
              <div className="aspect-square bg-muted flex items-center justify-center relative overflow-hidden">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={asset.url} 
                    alt={fileName} 
                    className="object-cover w-full h-full transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <FileIcon className="h-12 w-12 text-muted-foreground/50" />
                )}
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => copyToClipboard(asset.publicUrl || asset.url, asset.key)}
                    title="Copy URL"
                  >
                    {copiedKey === asset.key ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => deleteMutation.mutate(asset.key)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-3">
                <p className="text-sm font-medium truncate" title={fileName}>{fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {asset.size ? (asset.size / 1024).toFixed(1) + ' KB' : 'Unknown size'}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
