import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ChevronsUpDown, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterComboboxProps {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  isLoading?: boolean;
}

export default function FilterCombobox({
  label,
  placeholder,
  searchPlaceholder,
  values,
  selected,
  onSelect,
  isLoading,
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        {selected && (
          <button
            onClick={() => onSelect('')}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> clear
          </button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            disabled={isLoading}
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-lg border px-4 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              selected
                ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                : 'border-input bg-background text-muted-foreground hover:border-primary/40'
            )}
          >
            <span className="truncate">
              {isLoading ? 'Loading…' : selected || placeholder}
            </span>
            {isLoading ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty className="px-4 py-3 text-sm text-muted-foreground">
                No matches in database.
              </CommandEmpty>
              <CommandGroup>
                {values.map((v) => (
                  <CommandItem
                    key={v}
                    value={v}
                    onSelect={(current) => {
                      onSelect(current === selected ? '' : current);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected === v ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {v}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
