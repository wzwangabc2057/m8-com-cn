'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Users, FolderTree, Tags, Plus, MoreHorizontal, Edit2, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Author {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  url?: string;
  count?: number;
}

interface Category {
  slug: string;
  name: string;
  description?: string;
  featuredImage?: string;
  count?: number;
}

interface Tag {
  slug: string;
  name: string;
  description?: string;
  count?: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

export type MetaType = 'authors' | 'categories' | 'tags';

export function MetaManager({ type }: { type?: MetaType } = {}) {
  const { apiKey, siteId } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [authorDialog, setAuthorDialog] = useState<{ open: boolean; editing?: Author }>({ open: false });
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; editing?: Category }>({ open: false });
  const [tagDialog, setTagDialog] = useState<{ open: boolean; editing?: Tag }>({ open: false });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['meta', siteId],
    queryFn: async () => {
      const res = await axios.get(`/api/meta?siteId=${siteId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.data as { authors: Author[]; categories: Category[]; tags: Tag[] };
    },
    enabled: !!apiKey && !!siteId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { authors?: Author[]; categories?: Category[]; tags?: Tag[] }) => {
      await axios.post(`/api/meta?siteId=${siteId}`, payload, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta', siteId] });
      toast({ title: 'Saved', description: 'Meta data updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.error ?? err?.message ?? 'Failed to save', variant: 'destructive' });
    },
  });

  const updateAuthors = (fn: (prev: Author[]) => Author[]) => {
    const next = fn(data?.authors ?? []);
    saveMutation.mutate({ ...data, authors: next });
  };
  const updateCategories = (fn: (prev: Category[]) => Category[]) => {
    const next = fn(data?.categories ?? []);
    saveMutation.mutate({ ...data, categories: next });
  };
  const updateTags = (fn: (prev: Tag[]) => Tag[]) => {
    const next = fn(data?.tags ?? []);
    saveMutation.mutate({ ...data, tags: next });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {(error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Failed to load meta'}
      </div>
    );
  }

  const authors = data?.authors ?? [];
  const categories = data?.categories ?? [];
  const tags = data?.tags ?? [];

  const hasTabs = !type;

  const authorsSection = (
    <div className="mt-6">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setAuthorDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Author
            </Button>
          </div>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Bio</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No authors yet. Sync from migration or add manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  authors.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-sm">{a.id}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{a.bio ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAuthorDialog({ open: true, editing: a })}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (window.confirm('Delete this author?')) {
                                  updateAuthors((prev) => prev.filter((x) => x.id !== a.id));
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
    </div>
  );

  const categoriesSection = (
    <div className="mt-6">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setCategoryDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No categories yet. Sync from migration or add manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((c) => (
                    <TableRow key={c.slug}>
                      <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{c.description ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setCategoryDialog({ open: true, editing: c })}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (window.confirm('Delete this category?')) {
                                  updateCategories((prev) => prev.filter((x) => x.slug !== c.slug));
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
    </div>
  );

  const tagsSection = (
    <div className="mt-6">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setTagDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
          </div>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No tags yet. Sync from migration or add manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map((t) => (
                    <TableRow key={t.slug}>
                      <TableCell className="font-mono text-sm">{t.slug}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{t.description ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setTagDialog({ open: true, editing: t })}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (window.confirm('Delete this tag?')) {
                                  updateTags((prev) => prev.filter((x) => x.slug !== t.slug));
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
    </div>
  );

  const mainContent = hasTabs ? (
    <Tabs defaultValue="authors" className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="authors" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Authors ({authors.length})
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categories ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            Tags ({tags.length})
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="authors">{authorsSection}</TabsContent>
      <TabsContent value="categories">{categoriesSection}</TabsContent>
      <TabsContent value="tags">{tagsSection}</TabsContent>
    </Tabs>
  ) : type === 'authors' ? (
    authorsSection
  ) : type === 'categories' ? (
    categoriesSection
  ) : (
    tagsSection
  );

  return (
    <>
      {mainContent}

      <AuthorFormDialog
        open={authorDialog.open}
        editing={authorDialog.editing}
        onClose={() => setAuthorDialog({ open: false })}
        onSave={(author) => {
          if (authorDialog.editing) {
            updateAuthors((prev) => prev.map((a) => (a.id === authorDialog.editing!.id ? author : a)));
          } else {
            updateAuthors((prev) => [...prev, author]);
          }
          setAuthorDialog({ open: false });
        }}
        isSaving={saveMutation.isPending}
      />

      <CategoryFormDialog
        open={categoryDialog.open}
        editing={categoryDialog.editing}
        onClose={() => setCategoryDialog({ open: false })}
        onSave={(category) => {
          if (categoryDialog.editing) {
            updateCategories((prev) =>
              prev.map((c) => (c.slug === categoryDialog.editing!.slug ? category : c))
            );
          } else {
            updateCategories((prev) => [...prev, category]);
          }
          setCategoryDialog({ open: false });
        }}
        isSaving={saveMutation.isPending}
      />

      <TagFormDialog
        open={tagDialog.open}
        editing={tagDialog.editing}
        onClose={() => setTagDialog({ open: false })}
        onSave={(tag) => {
          if (tagDialog.editing) {
            updateTags((prev) => prev.map((t) => (t.slug === tagDialog.editing!.slug ? tag : t)));
          } else {
            updateTags((prev) => [...prev, tag]);
          }
          setTagDialog({ open: false });
        }}
        isSaving={saveMutation.isPending}
      />
    </>
  );
}

function getAvatarDisplayUrl(avatar: string, siteId: string): string {
  if (!avatar?.trim()) return '';
  if (avatar.startsWith('/site-assets/')) {
    const pathPart = avatar.slice('/site-assets/'.length);
    return `/api/proxy?key=${encodeURIComponent(`sites/${siteId}/assets/${pathPart}`)}`;
  }
  return avatar;
}

function AuthorFormDialog({
  open,
  editing,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  editing?: Author;
  onClose: () => void;
  onSave: (a: Author) => void;
  isSaving: boolean;
}) {
  const { apiKey, siteId } = useStore();
  const { toast } = useToast();
  const [id, setId] = useState(editing?.id ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [bio, setBio] = useState(editing?.bio ?? '');
  const [avatar, setAvatar] = useState(editing?.avatar ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setId(editing?.id ?? '');
      setName(editing?.name ?? '');
      setBio(editing?.bio ?? '');
      setAvatar(editing?.avatar ?? '');
      setUrl(editing?.url ?? '');
    }
  }, [open, editing]);

  const reset = () => {
    setId(editing?.id ?? '');
    setName(editing?.name ?? '');
    setBio(editing?.bio ?? '');
    setAvatar(editing?.avatar ?? '');
    setUrl(editing?.url ?? '');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      reset();
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = id.trim() || slugify(name) || 'unknown';
    onSave({ id: finalId, name: name.trim() || finalId, bio: bio.trim() || undefined, avatar: avatar.trim() || undefined, url: url.trim() || undefined });
  };

  const uploadAvatarFile = async (file: File) => {
    if (!siteId || !apiKey) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      toast({ title: 'Invalid file', description: 'Please upload an image (jpg, png, gif, webp)', variant: 'destructive' });
      return;
    }
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      const res = await axios.post(`/api/assets?siteId=${siteId}&overwrite=true`, formData, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.data?.success && res.data?.key) {
        const key = res.data.key as string;
        const pathPart = key.replace(`sites/${siteId}/assets/`, '');
        const siteAssetsUrl = `/site-assets/${pathPart}`;
        setAvatar(siteAssetsUrl);
        toast({ title: 'Avatar uploaded', description: 'Image saved successfully' });
      } else {
        toast({ title: 'Upload failed', description: res.data?.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.response?.data?.error ?? err?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatarFile(file);
    e.target.value = '';
  };

  const avatarDisplayUrl = getAvatarDisplayUrl(avatar, siteId ?? '');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Author' : 'Add Author'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="author-id">ID</Label>
            <Input
              id="author-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. john-doe (auto from name if empty)"
              disabled={!!editing}
            />
          </div>
          <div>
            <Label htmlFor="author-name">Name</Label>
            <Input id="author-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="author-bio">Bio</Label>
            <Textarea id="author-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Avatar</Label>
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary/50'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary/50'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-primary/50');
                  const f = e.dataTransfer.files?.[0];
                  if (f) uploadAvatarFile(f);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
                {avatarUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : avatarDisplayUrl ? (
                  <img src={avatarDisplayUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Upload</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm text-muted-foreground">Click or drag image to upload</p>
                {avatar && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setAvatar('')}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="author-url">URL</Label>
            <Input id="author-url" value={url} onChange={(e) => setUrl(e.target.value)} type="url" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryFormDialog({
  open,
  editing,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  editing?: Category;
  onClose: () => void;
  onSave: (c: Category) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [featuredImage, setFeaturedImage] = useState(editing?.featuredImage ?? '');

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setSlug(editing?.slug ?? '');
      setDescription(editing?.description ?? '');
      setFeaturedImage(editing?.featuredImage ?? '');
    }
  }, [open, editing]);

  const reset = () => {
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setDescription(editing?.description ?? '');
    setFeaturedImage(editing?.featuredImage ?? '');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      reset();
      onClose();
    }
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!editing) setSlug(slugify(v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = slug.trim() || slugify(name) || 'uncategorized';
    onSave({
      slug: finalSlug,
      name: name.trim() || finalSlug,
      description: description.trim() || undefined,
      featuredImage: featuredImage.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Auto-generated from name"
            />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="cat-img">Featured Image URL</Label>
            <Input id="cat-img" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} type="url" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TagFormDialog({
  open,
  editing,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  editing?: Tag;
  onClose: () => void;
  onSave: (t: Tag) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setSlug(editing?.slug ?? '');
      setDescription(editing?.description ?? '');
    }
  }, [open, editing]);

  const reset = () => {
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setDescription(editing?.description ?? '');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      reset();
      onClose();
    }
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!editing) setSlug(slugify(v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = slug.trim() || slugify(name) || 'untagged';
    onSave({
      slug: finalSlug,
      name: name.trim() || finalSlug,
      description: description.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Tag' : 'Add Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="tag-slug">Slug</Label>
            <Input
              id="tag-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Auto-generated from name"
            />
          </div>
          <div>
            <Label htmlFor="tag-desc">Description</Label>
            <Textarea id="tag-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
