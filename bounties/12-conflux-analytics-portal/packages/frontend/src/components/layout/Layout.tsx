import { Outlet } from 'react-router-dom';
import Header from './Header';

/** Root layout with header and content area. */
export default function Layout() {
  return (
    <div className="min-h-screen bg-background dark:bg-background-dark font-sans text-primary dark:text-primary-dark pb-10">
      <div className="max-w-[1400px] mx-auto flex flex-col">
        <Header />
        <main className="flex-1 px-8 pt-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
