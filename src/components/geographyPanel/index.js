import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import * as d3 from "d3";
import { nest } from "d3-collection";
import { Card, Space, Empty } from "antd";
import ReactMapboxGl, { Marker, Popup } from "react-mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { withTranslation } from "react-i18next";
import { GoGlobe } from "react-icons/go";
import { siteConfig } from "../../settings";
import Wrapper from "./index.style";
import MarkerCircle from "./marker-circle";
import MarkerPopup from "./marker-popup";

const Mapbox = ReactMapboxGl({
  minZoom: 1,
  maxZoom: 15,
  accessToken: siteConfig.mapBoxToken,
  antialias: true,
});

class GeographyPanel extends Component {
  state = {
    node: null,
    visible: false
  };

  handleClick = (node) => {
    this.setState({
      node: node,
      visible: true
    });
  };

  handleMouseOver = (node, visible) => {
    //this.setState({
    //  node: visible ? node : null
    //});
  };
  render() {
    let { t, geographyHash, strainsList } = this.props;
    const { node, visible } = this.state;
    const nestedTotalStrains = nest()
      .key((d) => d.gid)
      .entries(strainsList);
    const circleScale = d3
      .scaleLinear()
      .domain([1, d3.max(nestedTotalStrains, (d) => d.values.length)])
      .range([1, 13])
      .nice();
    return (
      <Wrapper empty={strainsList.length < 1}>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GoGlobe />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.geography-panel.header")}
              </span>
            </Space>
          }
        >
          <div className="ant-wrapper">
            {strainsList.length < 1 && <Empty description={t("components.geography-panel.no-data-message")}/>}
            {strainsList.length > 0 && 
            <Mapbox
              style={"mapbox://styles/mapbox/light-v10"}
              scrollZoom={false}
              fitBounds={[[-180, -70], [180, 90]]}
              flyToOptions={{ speed: 0.8 }}
              containerStyle={{
                height: 400,
                width: "100%",
              }}
            >
              {nestedTotalStrains.map((d, i) => (
                  <Marker
                    key={d.key}
                    coordinates={[
                      geographyHash[d.key].longitude,
                      geographyHash[d.key].latitude,
                    ]}
                    style={{ cursor: "pointer" }}
                    onClick={() => this.handleClick(d)}
                  >
                    <MarkerCircle
                      key={d.key}
                      lat={geographyHash[d.key].latitude}
                      lng={geographyHash[d.key].longitude}
                      text={d.values.length}
                      radius={circleScale(d.values.length)}
                      fill={geographyHash[d.key].fill}
                    />
                  </Marker>
                ))}
              {node && visible && (
                <Popup
                  key={node.key}
                  coordinates={[
                    geographyHash[node.key].longitude,
                    geographyHash[node.key].latitude,
                  ]}
                  offset={{ bottom: [0, -38] }}
                >
                  <MarkerPopup
                    title={geographyHash[node.key].title}
                    node={node}
                  />
                </Popup>
              )}
            </Mapbox>}
          </div>
        </Card>
      </Wrapper>
    );
  }
}
GeographyPanel.propTypes = {};
GeographyPanel.defaultProps = {
  strainsList: []
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  geography: state.App.geography,
  geographyHash: state.App.geographyHash,
  strainsList: state.Strains.strainsList,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GeographyPanel));
