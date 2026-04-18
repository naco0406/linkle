import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ChallengeEditorPage } from './pages/ChallengeEditorPage.js';
import { AdminLayout } from './components/AdminLayout.js';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'challenges/:date', element: <ChallengeEditorPage /> },
      { path: '*', element: <Navigate replace to="/" /> },
    ],
  },
]);
