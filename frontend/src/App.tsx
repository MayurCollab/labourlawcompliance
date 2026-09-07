import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/routes';
import { bootstrapAuthSession } from '@/services/auth.service';

function App() {
  useEffect(() => {
    void bootstrapAuthSession();
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
