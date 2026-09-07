import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { PATHS } from '@/routes/paths';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">403</h1>
      <p className="text-muted-foreground">
        You do not have permission to view this page.
      </p>
      <Button render={<Link to={PATHS.home} />}>Go home</Button>
    </div>
  );
}
