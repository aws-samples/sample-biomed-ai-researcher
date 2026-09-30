// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  House,
  List,
} from '@phosphor-icons/react';
import { useContext } from 'react';
import { AsideContext } from '../App';
import { Button } from './ui/button';
import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();
  const page = location?.pathname.replace('/', '').toLowerCase() || '';
  const { peerTasks, showPane, setShowPane } = useContext(AsideContext);

  return (
    <>
      <div className="right-2 top-2 fixed gap-1 flex-col flex z-10 h-full">
        <Button
          variant={'link'}
          size="default"
          onClick={() => {
            setShowPane(!showPane);
          }}
          className="cursor-pointer"
        >
          {peerTasks.length > 0 && (
            <small
              className="bg-red-600 rounded-full h-4 justify-center flex items-center text-white
            absolute -mt-4 ml-4 px-1"
            >
              {peerTasks.length}
            </small>
          )}
          <List weight="regular" size={27} />
        </Button>
        <hr className="border-gray-200" />
        <Button variant={'link'} size="default" title="Home">
          <Link to="/">
            <House
              weight="regular"
              size={27}
              className={page == '' ? 'text-cyan-600' : 'text-gray-800'}
            />
          </Link>
        </Button>
      </div>
    </>
  );
}
