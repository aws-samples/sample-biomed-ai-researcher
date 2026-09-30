// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dna } from '@phosphor-icons/react';

export function SearchOverview() {
  return (
    <div className="p-2">
      <div className="bg-gray-50 bg-gray-100 bg-gray-200 bg-gray-300 bg-gray-400 bg-gray-500 bg-gray-600 bg-gray-700 bg-gray-800 bg-gray-900"></div>

      <div className="lg:flex justify-between">
        <h4>
          <Dna size={24} className="inline mr-1" /> GPR75 in the Literature
        </h4>
        <div className="flex items-center gap-2">
          <Select defaultValue="species">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="species">Species</SelectItem>
              <SelectItem value="study_type">Study Type</SelectItem>
              <SelectItem value="study_age">Study Age</SelectItem>
              <SelectItem value="citation_count">Citation Count</SelectItem>
              <SelectItem value="perturbation">Perturbation</SelectItem>
            </SelectContent>
          </Select>
          &#215;
          <Select defaultValue="perturbation">
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="specimen">Specimen Type</SelectItem>
              <SelectItem value="study_type">Study Type</SelectItem>
              <SelectItem value="study_age">Study Age</SelectItem>
              <SelectItem value="citation_count">Citation Count</SelectItem>
              <SelectItem value="perturbation">Perturbation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <table className="text-center w-full border-t my-4">
        <tr className="border-b">
          <td>Human Study</td>
          <td>
            <Dot value={4} />
          </td>
          <td>
            <Dot value={2} />
          </td>
          <td>
            <Dot value={6} />
          </td>
          <td>
            <Dot value={1} />
          </td>
          <td>
            <Dot value={3} />
          </td>
        </tr>
        <tr className="border-b">
          <td>Animal Study</td>
          <td>
            <Dot value={1} />
          </td>
          <td>
            <Dot value={3} />
          </td>
          <td>
            <Dot value={6} />
          </td>
          <td>
            <Dot value={1} />
          </td>
          <td>
            <Dot value={6} />
          </td>
        </tr>
        <tr className="border-b">
          <td>In Vitro</td>
          <td>
            <Dot value={2} />
          </td>
          <td>
            <Dot value={6} />
          </td>
          <td>
            <Dot value={3} />
          </td>
          <td>
            <Dot value={2} />
          </td>
          <td>
            <Dot value={3} />
          </td>
        </tr>
        <tr className="">
          <td>&nbsp;</td>
          <td>Knockout</td>
          <td>Knockdown</td>
          <td>Overexpression</td>
          <td>Editing</td>
          <td>Other</td>
        </tr>
      </table>
    </div>
  );
}

function Dot(props: { value: number }) {
  return (
    <>
      <Popover>
        <PopoverTrigger>
          <div
            className={'m-4 h-4 w-4 rounded-full bg-gray-' + props.value + '00'}
          ></div>
        </PopoverTrigger>
        <PopoverContent>
          {props.value} papers found.
          <ul>
            <li>
              <Link to="/Paper">Paper 1</Link>
            </li>
            <li>
              <Link to="/Paper">Paper 2</Link>
            </li>
            <li>
              <Link to="/Paper">Paper 3</Link>
            </li>
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}
