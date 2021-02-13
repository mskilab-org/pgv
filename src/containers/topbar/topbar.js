import React, { Component } from "react";
import { Layout, Menu } from "antd";
import TopbarWrapper from "./topbar.style";
import { siteConfig } from "../../settings";
import logo from "../../assets/images/logo.png";

const { Header } = Layout;

class Topbar extends Component {
  render() {
    return (
      <TopbarWrapper>
        <Header className="ant-pro-top-menu">
          <div className="ant-pro-top-nav-header light">
            <div className="ant-pro-top-nav-header-main ">
              <div className="ant-pro-top-nav-header-main-left">
                <div className="ant-pro-top-nav-header-logo" id="logo">
                  <a href="/">
                    <img src={logo} alt="logo" />
                    <h1>{siteConfig.siteName}</h1>
                  </a>
                </div>
              </div>
              <div className="ant-pro-top-nav-header-menu">
                <Menu mode="horizontal" defaultSelectedKeys={["1"]}>
                  <Menu.Item key="1">
                    <a href="/">Home</a>
                  </Menu.Item>
                  <Menu.Item key="2">
                    <a href="/settings">Settings</a>
                  </Menu.Item>
                </Menu>
              </div>
              <div className="ant-pro-top-nav-header-main-right">
                <div className="ant-pro-top-nav-header-main-right-container">
                </div>
              </div>
            </div>
          </div>
        </Header>
      </TopbarWrapper>
    );
  }
}

export default Topbar;
