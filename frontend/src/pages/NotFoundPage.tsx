import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { PATHS } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">404</h1>
      <p className="text-muted-foreground">This page does not exist.</p>
      <Button render={<Link to={PATHS.home} />}>Go home</Button>
    </div>
  );
}
