// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  DotsThreeVertical,
  FolderPlus,
  Folders,
  Pencil,
  Trash,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function BookmarkFolderMenu() {
  return (
    <>
      <Popover>
        <PopoverTrigger>
          <button className="mt-1">
            <DotsThreeVertical size={24} weight="bold" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[150px] p-0">
          <div className="flex flex-col">
            <Button variant="ghost" size="sm" className="justify-start">
              <Pencil className="mr-1" /> Rename
            </Button>{' '}
            <Button variant="ghost" size="sm" className="justify-start">
              <Trash className="mr-1" /> Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
