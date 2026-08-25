import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import LockScreen from './LockScreen';
import { verifyAppLock } from '../../storage/appLock';

function AppLockGate({ children }) {
  const appLockEnabled = useSelector((state) => state.settings.appLockEnabled);
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState('idle');

  const attemptUnlock = useCallback(async () => {
    setStatus('checking');
    const success = await verifyAppLock();
    if (success) {
      setUnlocked(true);
      setStatus('idle');
    } else {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (appLockEnabled && !unlocked) {
      attemptUnlock();
    }
  }, [appLockEnabled, unlocked, attemptUnlock]);

  if (!appLockEnabled || unlocked) {
    return children;
  }

  return <LockScreen status={status} onUnlock={attemptUnlock} />;
}

export default AppLockGate;
