// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './App.css';
import Home from './Home';
import Search from './Search';
import Paper from './Paper';
import App from './App';
import { AuthWrapper } from './AuthWrapper';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: '/search/:query',
        element: <Search />,
      },
      {
        path: '/paper/:id',
        element: <Paper />,
      },
    ],
  },
]);

const rootElement = document.getElementById('root');

if (rootElement !== null) {
  ReactDOM.createRoot(rootElement).render(
    <AuthWrapper>
      <RouterProvider router={router} />
    </AuthWrapper>
  );
} else {
  // Handle the case where the root element is not found
  console.error('Root element not found in the DOM');
}