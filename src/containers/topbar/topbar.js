import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { withTranslation } from "react-i18next";
import { Layout, Menu } from "antd";
import { AiOutlineDashboard, AiOutlineTable } from "react-icons/ai";
import TopbarWrapper from "./topbar.style";
import { siteConfig } from "../../settings";
import logo from "../../assets/images/logo.png";

const { Header } = Layout;

class Topbar extends Component {
  state = {
    current: 'dashboard',
  };

  handleClick = e => {
    this.setState({ current: e.key });
  };

  render() {
    const { current } = this.state;
    const { t, file } = this.props;
    let params = file && `?file=${file}`;

    return (
      <TopbarWrapper>
        <Header className="ant-pro-top-menu">
          <div className="ant-pro-top-nav-header light">
            <div className="ant-pro-top-nav-header-main ">
              <div className="ant-pro-top-nav-header-main-left">
                <div className="ant-pro-top-nav-header-logo" id="logo" onClick={() => this.handleClick({key: 'dashboard'})}>
                  <Link to={`/${params}`}>
                    <img src={logo} alt="logo" />
                    <h1>{siteConfig.siteName}</h1>
                  </Link>
                </div>
              </div>
              <div className="ant-pro-top-nav-header-menu">
                <Menu mode="horizontal" onClick={this.handleClick} selectedKeys={[current]}>
                  <Menu.Item key="data-selection">
                    <Link to={`/data-selection/${params}`}>
                      <span role="img" className="anticon anticon-dashboard">
                        <AiOutlineTable />
                      </span>
                      <span className="ant-pro-menu-item-title">
                        {t("menu.data-selection.title")}
                      </span>
                    </Link>
                  </Menu.Item>
                  <Menu.Item key="dashboard">
                    <Link to={`/${params}`}>
                      <span role="img" className="anticon anticon-dashboard">
                        <AiOutlineDashboard />
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
Topbar.propTypes = {
  file: PropTypes.string
};
Topbar.defaultProps = {
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  file: state.App.file,
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(Topbar));
