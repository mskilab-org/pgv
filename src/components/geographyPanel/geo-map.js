import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as d3 from "d3";
import { nest } from "d3-collection";
import ReactMapboxGl, { Marker, Popup } from "react-mapbox-gl";
import MarkerCircle from "./marker-circle";
import MarkerPopup from "./marker-popup";
import { siteConfig } from "../../settings";
import "mapbox-gl/dist/mapbox-gl.css";

const Mapbox = ReactMapboxGl({
  minZoom: 1,
  maxZoom: 15,
  accessToken: siteConfig.mapBoxToken,
  antialias: true,
});
class GeoMap extends Component {
  state = {
    node: null,
    visible: false,
  };

  map = null;

  handleClick = (node) => {
    this.setState({
      node: node,
      visible: true,
    });
  };

  onLoaded = (map) => {
    this.map = map;
  };

  componentDidUpdate() {
    this.map && this.map.resize();
  }

  render() {
    let { width, height, geographyHash, strainsList } = this.props;
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
      <Mapbox
        // eslint-disable-next-line react/style-prop-object
        style={"mapbox://styles/mapbox/light-v10"}
        scrollZoom={false}
        fitBounds={[
          [-180, -70],
          [180, 90],
        ]}
        flyToOptions={{ speed: 0.8 }}
        onStyleLoad={(map) => this.onLoaded(map)}
        containerStyle={{
          height: height,
          width: width,
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
              key={node.key}
              title={geographyHash[node.key].title}
              node={node}
            />
          </Popup>
        )}
      </Mapbox>
    );
  }
}
GeoMap.propTypes = {
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
};
GeoMap.defaultProps = {
  strainsList: [],
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
)(withTranslation("common")(GeoMap));
