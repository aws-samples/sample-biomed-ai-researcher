// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Button } from './ui/button';
import { useState } from 'react';

import { cn } from '../lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';

export function Combobox(props: {
  label: string;
  items: any;
  value?: string;
  onChange?: (value: string) => void;
}) {
  let items: { value: string; label: string }[] = [];
  props.items.forEach((v: any) => {
    items.push({ value: v, label: v });
  });

  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  // Controlled when a value prop is supplied, otherwise fall back to local state.
  const value = props.value !== undefined ? props.value : internalValue;
  const setValue = (v: string) => {
    if (props.onChange) props.onChange(v);
    else setInternalValue(v);
  };

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value
              ? items.find((item) => item.value === value)?.label
              : props.label}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            {items.length > 5 && <CommandInput placeholder="Search item..." />}
            <CommandList>
              <CommandEmpty>No item found.</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={(currentValue) => {
                      setValue(currentValue === value ? '' : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {item.label}
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
