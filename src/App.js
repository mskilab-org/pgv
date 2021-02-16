import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { Layout, ConfigProvider } from "antd";
import { store, history } from "./redux/store";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import PublicRoutes from "./router";
import Boot from "./redux/boot";
import i18n from "./i18n";
import en_US from "antd/lib/locale/en_US";
import AppHolder from "./commonStyle";
import { siteConfig } from "./settings";
import Topbar from "./containers/topbar/topbar";
import "antd/dist/antd.css";
import "./global.css";

const { Content, Footer } = Layout;

function App() {
  return (
    <ConfigProvider locale={en_US}>
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          <Router history={history}>
            <AppHolder>
              <Layout className="ant-full-layout">
                <Topbar />
                <Content className="ant-full-content">
                  <PublicRoutes />
                </Content>
                <Footer className="ant-full-footer">
                  {siteConfig.footerText}
                </Footer>
              </Layout>
            </AppHolder>
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
