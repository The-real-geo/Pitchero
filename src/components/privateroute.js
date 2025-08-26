// pitchero/src/components/PrivateRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase"; // "../" because it's in components folder

const PrivateRoute = ({ children }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div>Loading...</div>; // optional loading state

  return user ? children : <Navigate to="/login" />;
};

export default PrivateRoute;