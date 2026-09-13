import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';
import { useEffect, useState } from 'react';

interface TenantSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TenantSearch({ value, onChange, placeholder = 'Rechercher par nom ou téléphone...' }: TenantSearchProps) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounce(local, 300);

  useEffect(() => {
    onChange(debounced);
  }, [debounced, onChange]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
        aria-label="Rechercher un locataire"
      />
    </div>
  );
}
