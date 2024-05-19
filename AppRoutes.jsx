import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import Settings from "./pages/Settings/Settings";
import Help from "./pages/Help/Help";

const AppRoutes = () => {
  return (
    <Routes>
      <Route index path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/help" element={<Help />} />
      {/* <Route index path="company" element={<Company />} /> */}
    </Routes>
  );
};

export default AppRoutes;
