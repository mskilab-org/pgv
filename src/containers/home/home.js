import React, { Component } from "react";
import ContainerDimensions from "react-container-dimensions";
import { Row, Col } from "antd";
import HomeWrapper from "./home.style";
import Header from "../../components/header";
import Legend from "../../components/legend";

class Home extends Component {
  render() {
    return (
      <HomeWrapper>
        <div className="ant-home-header-container">
          <Header/>
        </div>
        <div className="ant-home-content-container">
        <Row gutter={0} className="ant-home-legend-container">
            <Col className="gutter-row" span={24}>
            <ContainerDimensions>
              { ({ width }) => {
                return <Legend {...{ width }} />;
              } }
              </ContainerDimensions>
            </Col>
        </Row>
        </div>
      </HomeWrapper>
    );
  }
}

export default Home;
