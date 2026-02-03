import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Layout.module.css';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>zzip.to Admin</h1>
        <div className={styles.userInfo}>
          <span className={styles.email}>{user?.email ?? user?.username}</span>
          <button onClick={signOut} className={styles.signOutButton}>
            Sign Out
          </button>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
