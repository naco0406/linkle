import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './components/RootLayout.js';
import { HomePage } from './pages/HomePage.js';
import { PlayPage } from './pages/PlayPage.js';
import { DonePage } from './pages/DonePage.js';
import { RankingPage } from './pages/RankingPage.js';
import { YesterdayPage } from './pages/YesterdayPage.js';
import { AboutPage } from './pages/AboutPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play', element: <PlayPage /> },
      { path: 'play/done', element: <DonePage /> },
      { path: 'ranking', element: <RankingPage /> },
      { path: 'yesterday', element: <YesterdayPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/home', element: <Navigate replace to="/" /> },
]);
