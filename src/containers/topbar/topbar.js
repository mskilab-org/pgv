import React, { Component } from "react";
import { Link } from "react-router-dom";
import { withTranslation } from "react-i18next";
import { Layout, Menu } from "antd";
import { AiOutlineDashboard, AiOutlineTable } from "react-icons/ai";
import TopbarWrapper from "./topbar.style";
import { siteConfig } from "../../settings";
import logo from "../../assets/images/logo.png";

const { Header } = Layout;

class Topbar extends Component {
  render() {
    const { t } = this.props;
    return (
      <TopbarWrapper>
        <Header className="ant-pro-top-menu">
          <div className="ant-pro-top-nav-header light">
            <div className="ant-pro-top-nav-header-main ">
              <div className="ant-pro-top-nav-header-main-left">
                <div className="ant-pro-top-nav-header-logo" id="logo">
                  <Link to="/">
                    <img src={logo} alt="logo" />
                    <h1>{siteConfig.siteName}</h1>
                  </Link>
                </div>
              </div>
              <div className="ant-pro-top-nav-header-menu">
                <Menu mode="horizontal" defaultSelectedKeys={["2"]}>
                  <Menu.Item key="1">
                    <Link to="/data-selection">
                      <span role="img" className="anticon anticon-dashboard">
                        <AiOutlineDashboard />
                      </span>
                      <span className="ant-pro-menu-item-title">
                        {t("menu.data-selection.title")}
                      </span>
                    </Link>
                  </Menu.Item>
                  <Menu.Item key="2">
                    <Link to="/">
                      <span role="img" className="anticon anticon-dashboard">
                        <AiOutlineTable />
                      </span>
                      <span className="ant-pro-menu-item-title">
                        {t("menu.home.title")}
                      </span>
                    </Link>
                  </Menu.Item>
                </Menu>
              </div>
              <div className="ant-pro-top-nav-header-main-right">
                <div className="ant-pro-top-nav-header-main-right-container"></div>
              </div>
            </div>
          </div>
        </Header>
      </TopbarWrapper>
    );
  }
}

export default withTranslation("common")(Topbar);
