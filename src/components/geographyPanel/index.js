import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import * as d3 from "d3";
import { nest } from "d3-collection";
import { Card, Space } from "antd";
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
  state = {};

  onToggleHover(cursor, { map }) {
    console.log(map);
    //map.getCanvas().style.cursor = cursor;
  }

  handleMouseOver = (node, visible) => {
    console.log(node);
    this.setState({
      node: visible ? node : null
    });
  };
  render() {
    let { t, geographyHash, geography, strainsList } = this.props;
    const { node } = this.state;
    const nestedTotalStrains = nest()
      .key((d) => d.gid)
      .entries(strainsList);
    const circleScale = d3
      .scaleLinear()
      .domain([1, d3.max(nestedTotalStrains, (d) => d.values.length)])
      .range([1, 13])
      .nice();
    const bounds =
      geography.length * strainsList.length > 0
        ? [
            [
              d3.min(strainsList, (d) => geographyHash[d.gid].longitude),
              d3.min(strainsList, (d) => geographyHash[d.gid].latitude),
            ],
            [
              d3.max(strainsList, (d) => geographyHash[d.gid].longitude),
              d3.max(strainsList, (d) => geographyHash[d.gid].latitude),
            ],
          ]
        : undefined;
    return (
      <Wrapper>
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
            <Mapbox
              style={"mapbox://styles/mapbox/light-v10"}
              fitBounds={bounds}
              scrollZoom={true}
              flyToOptions={{ speed: 0.8 }}
              containerStyle={{
                height: 400,
                width: "100%",
              }}
            >
              {geography.length > 0 &&
                nestedTotalStrains.map((d, i) => (
                  <Marker
                    key={d.key}
                    coordinates={[
                      geographyHash[d.key].longitude,
                      geographyHash[d.key].latitude,
                    ]}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => this.handleMouseOver(d, true)}
                    onMouseLeave={() => this.handleMouseOver(d, false)}
                  >
                    <MarkerCircle
                      key={d.key}
                      lat={geographyHash[d.key].latitude}
                      lng={geographyHash[d.key].longitude}
                      text={geographyHash[d.key].code}
                      radius={circleScale(d.values.length)}
                      fill={geographyHash[d.key].fill}
                    />
                  </Marker>
                ))}
              {node && (
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
                    content={t("components.geography-panel.tooltip.content.strain", {count: node.values.length})}
                  />
                </Popup>
              )}
            </Mapbox>
          </div>
        </Card>
      </Wrapper>
    );
  }
}
GeographyPanel.propTypes = {};
GeographyPanel.defaultProps = {
  strainsList: [],
  geographyHash: {},
  geography: [],
};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  geography: state.Strains.geography,
  geographyHash: state.Strains.geographyHash,
  strainsList: state.Strains.strainsList,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GeographyPanel));
