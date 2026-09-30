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

export function BookmarkMenu() {
  return (
    <>
      <Popover>
        <PopoverTrigger>
          <Button variant="link" size="sm">
            <DotsThreeVertical size={24} weight="bold" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[150px] p-0">
          <div className="flex flex-col">
            <Button variant="ghost" size="sm" className="justify-start">
              <Pencil className="mr-1" /> Edit
            </Button>{' '}
            <Button variant="ghost" size="sm" className="justify-start">
              <Folders className="mr-1" /> Copy to...
            </Button>
            <Button variant="ghost" size="sm" className="justify-start">
              <FolderPlus className="mr-1" /> Move to...
            </Button>
            <Button variant="ghost" size="sm" className="justify-start">
              <Trash className="mr-1" /> Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
