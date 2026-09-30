# Main Application Router Configuration

## Overview
This file configures the main routing setup for a React application using React Router. It defines the application's navigation structure and renders the root application component.

## Dependencies
- react-dom
- react-router-dom
- Various component files:
  - App
  - Home
  - Search
  - Paper
  - History
  - Bookmarks
  - Genes

## Router Configuration

### Base Route
- Path: `/`
- Component: `App`

### Child Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/` (index) | `Home` | Main landing page |
| `/history` | `History` | User history view |
| `/bookmarks` | `Bookmarks` | Saved bookmarks view |
| `/genes` | `Genes` | Genes information page |
| `/search/:query` | `Search` | Search results page with query parameter |
| `/paper/:id` | `Paper` | Individual paper view with ID parameter |

## Implementation Details

### Router Setup
```typescript
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Child routes configuration
    ]
  }
]);
