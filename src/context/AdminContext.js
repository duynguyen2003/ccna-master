import React, { createContext, useContext, useState } from 'react';

export const AdminContext = createContext();

export const useAdmin = () => useContext(AdminContext);

export const AdminContextProvider = ({ children }) => {
  const [state, setState] = useState({});
  return (
    <AdminContext.Provider value={{ state, setState }}>
      {children}
    </AdminContext.Provider>
  );
};
