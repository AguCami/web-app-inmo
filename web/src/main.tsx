import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Proximamente } from './Proximamente';
import '../../src/styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Proximamente />
  </StrictMode>,
);
