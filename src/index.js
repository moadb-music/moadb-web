import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import Admin from './Admin';
import AdminLogin from './AdminLogin';
import RequireAuth from './RequireAuth';
import Tree from './Tree';
import Donate from './Donate';
import Members from './Members';
import MembersLogin from './MembersLogin';
import Loja from './Loja';
import { AuthProvider } from './authContext';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const isLojaSubdomain = window.location.hostname === 'loja.moadb.com.br';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {isLojaSubdomain ? (
          <Routes>
            <Route path="/*" element={<Loja />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/login" element={<MembersLogin />} />
            <Route path="/loja/*" element={<Loja />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <Admin />
                </RequireAuth>
              }
            />
          </Routes>
        )}
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
