import './globals.css';
import { AuthProvider } from '@/lib/client/auth-context';
import NavBar from '@/components/NavBar';

export const metadata = {
  title: 'Disaster Response',
  description: 'Coordinate incidents, resources, and community reports.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavBar />
          <main className="container">{children}</main>
          <footer className="footer">
            <span className="faint">Take-home build. Read endpoints are public; writes require an authenticated session.</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
