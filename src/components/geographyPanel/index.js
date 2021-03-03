import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space } from "antd";
import GoogleMapReact from "google-map-react";
import { withTranslation } from "react-i18next";
import { GoGlobe } from "react-icons/go";
import { siteConfig } from "../../settings";
import Wrapper from "./index.style";
import Marker from "./marker";

class GeographyPanel extends Component {

  handleApiLoaded = (map, maps) => {
    console.log(map, maps, maps.LatLng(22.355803, 91.767919))
    var LatLngList = [maps.LatLng(22.355803, 91.767919), maps.LatLng(52.564,-2.017)];
    //  Create a new viewpoint bound
    var bounds = new maps.LatLngBounds();
    //  Go through each...
    for (var i = 0, LtLgLen = LatLngList.length; i < LtLgLen; i++) {
    //  And increase the bounds to take this point
    bounds.extend(LatLngList[i]);
}
//  Fit these bounds to the map
map.fitBounds(bounds);
  };

  render() {
    const { t, center, zoom, geography, strainsList } = this.props;
    const geographyHash = {};
    geography.forEach((d,i) => geographyHash[d.id] = d);
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
          <div className="ant-wrapper" style={{ height: '400px', width: '100%' }}>
            <GoogleMapReact
              bootstrapURLKeys={{
                key: siteConfig.googleMapsAPI,
              }}
              defaultCenter={center}
              defaultZoom={zoom}
              yesIWantToUseGoogleMapApiInternals={true}
              onGoogleApiLoaded={({ map, maps }) => this.handleApiLoaded(map, maps)}
            >
              {geography.length > 0 && strainsList.map((d,i) => <Marker
                key={i}
                lat={geographyHash[d.gid].latitude}
                lng={geographyHash[d.gid].longitude}
                text={geographyHash[d.gid].code}
                fill={geographyHash[d.gid].fill}
              />)}
              
            </GoogleMapReact>
          </div>
        </Card>
      </Wrapper>
    );
  }
}
GeographyPanel.propTypes = {};
GeographyPanel.defaultProps = {
  center: {
    lat: 0,
    lng: 0,
  },
  zoom: 1,
  strainsList: [],
  geography: []
};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
  geography: state.Strains.geography,
  strainsList: state.Strains.strainsList
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GeographyPanel));
