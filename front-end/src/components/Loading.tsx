// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Skeleton } from './ui/skeleton';

export function Loading() {
  return (
    <div>
      <Skeleton className="w-1/4 h-4 rounded-full my-2" />
      <Skeleton className="w-1/4 h-4 rounded-full my-2" />
      <Skeleton className="w-1/4 h-4 rounded-full my-2" />
    </div>
  );
}
