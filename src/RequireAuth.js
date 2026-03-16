import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

const ALLOWED_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;

  const email = (user.email || '').toLowerCase();
  const hasAllowlist = ALLOWED_EMAILS.length > 0;
  const allowed = !hasAllowlist || ALLOWED_EMAILS.includes(email);

  if (!allowed) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location, notAllowed: true, email }}
      />
    );
  }

  return children;
}
