import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function RouteScrollTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const h1 = document.querySelector('h1[tabindex="-1"]');
    if (h1 instanceof HTMLElement) h1.focus({ preventScroll: true });
  }, [pathname, navigationType]);
  return null;
}
