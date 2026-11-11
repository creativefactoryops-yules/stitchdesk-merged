/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { Announcer } from './lib/a11y';
import Home from './pages/Home';
import ShopPortal from './pages/client/ShopPortal';
import JobStatus from './pages/JobStatus';
import ShopApp from './pages/shop/ShopApp';
import NotFound from './pages/NotFound';

// The single-file phone preview uses hash URLs (#/s/maple-demo) so it works with no server.
const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <Announcer>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/s/:slug/*" element={<ShopPortal />} />
          <Route path="/j/:token" element={<JobStatus />} />
          <Route path="/shop/*" element={<ShopApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Announcer>
    </Router>
  );
}
