// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { Button } from './ui/button';

export function Feedback() {
  return (
    <div className="-mr-2">
      <Button variant="link" className="hover:text-cyan-700">
        <ThumbsDown size={18} />
      </Button>
      <Button variant="link" className="hover:text-cyan-700">
        <ThumbsUp size={18} />
      </Button>
    </div>
  );
}
