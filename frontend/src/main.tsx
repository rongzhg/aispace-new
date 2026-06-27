import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { detectApi } from "./api";

// 启动先探测后端（连得上走真实 API，否则前端 mock）
detectApi().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
