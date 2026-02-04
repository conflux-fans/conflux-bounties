import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Overview from './pages/Overview';
import Contracts from './pages/Contracts';
import Tokens from './pages/Tokens';
import DApps from './pages/DApps';
import Fees from './pages/Fees';
import SharedView from './pages/SharedView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/tokens" element={<Tokens />} />
          <Route path="/dapps" element={<DApps />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/s/:slug" element={<SharedView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
