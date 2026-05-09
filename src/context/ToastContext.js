import React, { createContext, useContext, useState } from 'react';

export const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastContextProvider = ({ children }) => {
  const [state, setState] = useState({});
  return (
    <ToastContext.Provider value={{ state, setState }}>
      {children}
    </ToastContext.Provider>
  );
};
