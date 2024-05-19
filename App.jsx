import React, { createContext, useEffect, useState } from "react";
import AppRoutes from "./AppRoutes";
import "./App.css";
import { getBooleanFromLocalStorage } from "./utils/utils";

const InitialContext = createContext();

function App() {
  const [settings, setSettings] = useState({
    enableTool: localStorage.getItem("isConnected") || false,
    enableHeader: true,
    enableAttachement: true,
    enableURL: true,
  });
  const [emails, setEmails] = useState([]);
  const [token, setToken] = useState(null);
  const [notify, setNotify] = useState(getBooleanFromLocalStorage('notify') || true);

  useEffect(() => {
    const set = localStorage.getItem("settings")
      ? JSON.parse(localStorage.getItem("settings"))
      : null;
    if (set) {
      setSettings({
        ...set,
        enableTool: getBooleanFromLocalStorage('isConnected') || false,
      });
    }
  }, []);

  return (
    <React.Fragment>
      <InitialContext.Provider
        value={{
          settings,
          setSettings,
          emails,
          setEmails,
          token,
          setToken,
          notify,
          setNotify,
        }}
      >
        <AppRoutes />
      </InitialContext.Provider>
    </React.Fragment>
  );
}

export default App;
export { InitialContext };
