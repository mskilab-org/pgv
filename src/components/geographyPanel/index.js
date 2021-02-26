import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Space } from "antd";
import GoogleMapReact from "google-map-react";
import { withTranslation } from "react-i18next";
import { GoGlobe } from "react-icons/go";
import { siteConfig } from "../../settings";
import Wrapper from "./index.style";

const AnyReactComponent = ({ text }) => <div>{text}</div>;

class GeographyPanel extends Component {

  handleApiLoaded = (map, maps) => {
    console.log(map, maps, maps.LatLng(22.355803, 91.767919))
  };

  render() {
    const { t, center, zoom } = this.props;
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
            <GoogleMapReact
              bootstrapURLKeys={{
                key: siteConfig.googleMapsAPI,
              }}
              defaultCenter={center}
              defaultZoom={zoom}
              yesIWantToUseGoogleMapApiInternals={true}
              onGoogleApiLoaded={({ map, maps }) => this.handleApiLoaded(map, maps)}
            >
              <AnyReactComponent
                lat={40.7831}
                lng={-73.9712}
                text="My Marker"
              />
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
    lat: 40.7831,
    lng: -73.9712,
  },
  zoom: 11,
};
export default withTranslation("common")(GeographyPanel);
