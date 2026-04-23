'use client';

import { useState, useEffect } from 'react';
import { NavItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, GripVertical } from 'lucide-react';

interface NavigationEditorProps {
  items: NavItem[];
  onChange: (items: NavItem[]) => void;
}

export function NavigationEditor({ items, onChange }: NavigationEditorProps) {
  // Local state to manage edits before parent update
  const [navItems, setNavItems] = useState<NavItem[]>(items || []);

  // Sync with prop changes
  useEffect(() => {
    setNavItems(items || []);
  }, [items]);

  const updateParent = (newItems: NavItem[]) => {
    setNavItems(newItems);
    onChange(newItems);
  };

  const handleChange = (index: number, field: keyof NavItem, value: string) => {
    const newItems = [...navItems];
    newItems[index] = { ...newItems[index], [field]: value };
    updateParent(newItems);
  };

  const handleAdd = () => {
    const newItems = [...navItems, { label: 'New Link', href: '/' }];
    updateParent(newItems);
  };

  const handleDelete = (index: number) => {
    const newItems = navItems.filter((_, i) => i !== index);
    updateParent(newItems);
  };

  return (
    <div className="space-y-4">
      {navItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-white group hover:border-gray-400 transition-colors">
          <GripVertical className="text-gray-300 cursor-move h-4 w-4 group-hover:text-gray-500" />
          <div className="grid grid-cols-2 gap-2 flex-1">
            <Input 
              value={item.label} 
              onChange={(e) => handleChange(index, 'label', e.target.value)}
              placeholder="Label (e.g. Home)"
              className="h-9"
            />
            <Input 
              value={item.href} 
              onChange={(e) => handleChange(index, 'href', e.target.value)}
              placeholder="URL (e.g. /)"
              className="h-9 font-mono text-xs"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(index)} className="h-9 w-9 text-gray-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={handleAdd} className="w-full border-dashed">
        <Plus className="h-4 w-4 mr-2" /> Add Navigation Item
      </Button>
    </div>
  );
}
