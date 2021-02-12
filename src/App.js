import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ConfigProvider } from "antd";
import { store, history } from "./redux/store";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import PublicRoutes from "./router";
import Boot from "./redux/boot";
import i18n from "./i18n";
import en_US from "antd/lib/locale/en_US";
import "antd/dist/antd.css";
import "./assets/css/style.css";
import "./App.css";

function App() {
  return (
    <ConfigProvider locale={en_US}>
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <Router history={history}>
            <PublicRoutes />
          </Router>
        </I18nextProvider>
      </Provider>
    </ConfigProvider>
  );
}
Boot()
  .then(() => App())
  .catch((error) => console.error(error));
export default App;
