import React, {Component} from 'react';
import { Layout, Menu, Breadcrumb } from "antd";

const { Header, Content, Footer } = Layout;

class Home extends Component {
  render() {
    return (
          <div>
          <Breadcrumb style={{ margin: "16px 0" }}>
            <Breadcrumb.Item>Home</Breadcrumb.Item>
            <Breadcrumb.Item>List</Breadcrumb.Item>
            <Breadcrumb.Item>App</Breadcrumb.Item>
          </Breadcrumb>
          <div
            className="site-layout-background"
            style={{ padding: 24, minHeight: 380 }}
          >
            Home
          </div>
        </div>
       
    );
  }
}

export default Home;
