'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X, Upload, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { useStore } from '@/lib/store';

interface ProductImagesProps {
  images: string[];
  thumbnail: string;
  onChange: (images: string[], thumbnail: string) => void;
}

export function ProductImages({ images, thumbnail, onChange }: ProductImagesProps) {
  const { apiKey, siteId } = useStore();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`/api/assets?siteId=${siteId}`, formData, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const newUrl = res.data.publicUrl || res.data.url;
      const newImages = [...images, newUrl];
      // Set as thumbnail if it's the first image
      const newThumbnail = thumbnail || newUrl;
      onChange(newImages, newThumbnail);
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    const newImages = images.filter((img) => img !== url);
    let newThumbnail = thumbnail;
    if (thumbnail === url) {
      newThumbnail = newImages[0] || '';
    }
    onChange(newImages, newThumbnail);
  };

  const setAsThumbnail = (url: string) => {
    onChange(images, url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Images</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload Image
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
          />
        </div>
      </div>

      {images.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground bg-gray-50">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images uploaded</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div key={url} className="relative group border rounded-lg overflow-hidden bg-white aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeImage(url)}
                >
                  <X className="h-4 w-4" />
                </Button>
                {thumbnail !== url && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setAsThumbnail(url)}
                  >
                    Set Thumb
                  </Button>
                )}
              </div>
              {thumbnail === url && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md shadow-sm">
                  Thumbnail
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
