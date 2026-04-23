'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

interface ProductOption {
  title: string;
  values: string[];
}

interface ProductOptionsProps {
  options: ProductOption[];
  onChange: (options: ProductOption[]) => void;
}

export function ProductOptions({ options, onChange }: ProductOptionsProps) {
  const [newOptionTitle, setNewOptionTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [activeOptionIndex, setActiveOptionIndex] = useState<number | null>(null);

  const addOption = () => {
    if (!newOptionTitle) return;
    onChange([...options, { title: newOptionTitle, values: [] }]);
    setNewOptionTitle('');
  };

  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    onChange(newOptions);
  };

  const addValue = (index: number) => {
    if (!newValue) return;
    const newOptions = [...options];
    if (!newOptions[index].values.includes(newValue)) {
      newOptions[index].values.push(newValue);
      onChange(newOptions);
    }
    setNewValue('');
  };

  const removeValue = (optionIndex: number, valueIndex: number) => {
    const newOptions = [...options];
    newOptions[optionIndex].values.splice(valueIndex, 1);
    onChange(newOptions);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {options.map((option, index) => (
          <div key={index} className="border p-4 rounded-md relative">
             <Button 
               variant="ghost" 
               size="icon" 
               className="absolute top-2 right-2 h-6 w-6" 
               onClick={() => removeOption(index)}
             >
               <X className="h-4 w-4" />
             </Button>
             <div className="mb-2 font-medium">{option.title}</div>
             <div className="flex flex-wrap gap-2 mb-2">
               {option.values.map((val, vIndex) => (
                 <Badge key={vIndex} variant="secondary" className="gap-1">
                   {val}
                   <X 
                     className="h-3 w-3 cursor-pointer" 
                     onClick={() => removeValue(index, vIndex)} 
                   />
                 </Badge>
               ))}
             </div>
             <div className="flex gap-2">
               <Input 
                 placeholder="Add value (e.g. Red, XL)" 
                 className="h-8"
                 value={activeOptionIndex === index ? newValue : ''}
                 onChange={(e) => {
                   setActiveOptionIndex(index);
                   setNewValue(e.target.value);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     e.preventDefault();
                     addValue(index);
                   }
                 }}
               />
               <Button size="sm" variant="outline" onClick={() => addValue(index)}>Add</Button>
             </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label>New Option Name</Label>
          <Input 
            placeholder="e.g. Color, Size" 
            value={newOptionTitle} 
            onChange={(e) => setNewOptionTitle(e.target.value)} 
          />
        </div>
        <Button onClick={addOption} disabled={!newOptionTitle}>
          <Plus className="mr-2 h-4 w-4" />
          Add Option
        </Button>
      </div>
    </div>
  );
}
