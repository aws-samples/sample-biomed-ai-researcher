// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { MagnifyingGlass, SignOut } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from './ui/input';
import { useState } from 'react';
import { auth } from '../auth';
import { Button } from './ui/button';

function Header(props: { hideSearch?: boolean }) {
  let hideSearch = props.hideSearch;
  const [query, setQuery] = useState<string>('');
  const navigate = useNavigate();

  const handleSignOut = () => {
    auth.signOut();
    window.location.reload();
  };

  return (
    <>
      {!hideSearch && (
        <>
          <div className="md:flex mb-20">
            <div className="mx-auto w-[250px] pt-1">
              <div className="w-10/12 mx-auto">
                <Link to="/">
                  <img src="/logotype.svg" />
                </Link>
              </div>
            </div>
            <div className="p-2 flex items-center grow gap-3 justify-center md:justify-start">
              <div className="w-8/12 flex items-center">
                <Input
                  type="text"
                  placeholder='Enter genes and keywords: "GPR75, Heart Disease"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      navigate(`/Search/${query}`);
                    }
                  }}
                />
                <Link to={'/Search/' + query}>
                  <MagnifyingGlass className="-ml-8 mr-8" />
                </Link>
              </div>
              <Button variant="ghost" onClick={handleSignOut} title="Sign Out">
                <SignOut size={20} />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default Header;
