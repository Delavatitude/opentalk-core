import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '@/api/client';

export default function ProtectedRoute({ unauthenticatedElement, requiredRole }) {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let active = true;
    api.auth.me()
      .then(user => { if (active) setState({ loading: false, user }); })
      .catch(() => { if (active) setState({ loading: false, user: null }); });
    return () => { active = false; };
  }, []);

  if (state.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!state.user) return unauthenticatedElement || <Navigate to="/login" replace />;

  if (requiredRole && state.user.role !== requiredRole) return <Navigate to="/" replace />;

  return <Outlet />;
}
