import { useState, useCallback } from 'react';

export const useToast = () => {
  const [message, setMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  }, []);

  return { message, showToast };
};
