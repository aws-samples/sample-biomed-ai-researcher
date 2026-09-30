// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Check } from '@phosphor-icons/react';

export function Tag(props: any) {
  return (
    <>
      {props.highlight == undefined && (
        <Badge variant="outline" className="hover:bg-gray-100">
          <Link
            className="text-black whitespace-nowrap"
            to={'/Search/' + props.children}
          >
            {props.children}
          </Link>
        </Badge>
      )}
      {props.highlight === true && (
        <Badge variant="outline" className="hover:bg-gray-100">
          <Link
            className="text-black whitespace-nowrap"
            to={'/Search/' + props.children}
          >
            <Check className="inline mr-1" />
            {props.children}
          </Link>
        </Badge>
      )}
      {props.highlight === false && (
        <Badge
          variant="outline"
          className="hover:bg-gray-100 bg-gray-100"
          title="Gene not matched"
        >
          <Link
            className="text-gray-400 whitespace-nowrap"
            to={'/Search/' + props.children}
          >
            {props.children}
          </Link>
        </Badge>
      )}
    </>
  );
}
