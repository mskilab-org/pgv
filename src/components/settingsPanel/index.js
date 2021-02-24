import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Row, Col, Radio, Switch, Divider, Space, List } from "antd";
import { withTranslation } from "react-i18next";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { Button, Group } = Radio;
const { updateCoordinates, updateVisibility } = appActions;

class SettingsPanel extends Component {
  onCoordinateChange = (e) => {
    this.props.updateCoordinates(e.target.value);
  };

  onPanelViewChange = (property, checked) => {
    this.props.updateVisibility(property, checked);
  };

  render() {
    const { t, coordinates, selectedCoordinate, panels } = this.props;
    return (
      <Wrapper>
        <Row gutter={12}>
          <Col className="gutter-row" span={24}>
            <Divider orientation="left" plain>
              <h3 className="ant-pro-setting-drawer-title">{t("components.settings-panel.coordinates.label")}</h3>
            </Divider>
          </Col>
          <Col className="gutter-row" span={24}>
            <Group
              onChange={this.onCoordinateChange}
              defaultValue={selectedCoordinate || coordinates.default}
            >
              {Object.keys(coordinates.sets).map((d) => (
                <Button key={d} value={d}>
                  {d}
                </Button>
              ))}
            </Group>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col className="gutter-row" span={24}>
            <Divider orientation="left" plain>
              <h3 className="ant-pro-setting-drawer-title">{t("components.settings-panel.panels.label")}</h3>
            </Divider>
          </Col>
          <Col span={24}>
            <List
              className="ant-list"
              size="small"
              dataSource={Object.keys(panels)}
              renderItem={(d) => (
                <List.Item
                  key={d}
                  extra={
                    <Switch
                      size="small"
                      defaultChecked={panels[d].visible}
                      onChange={(checked) => this.onPanelViewChange(d, checked)}
                    />
                  }
                >
                  <label>{t(`components.${d}-panel.header`)}</label>
                </List.Item>
              )}
            />
          </Col>
        </Row>
      </Wrapper>
    );
  }
}
SettingsPanel.propTypes = {};
SettingsPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateCoordinates: (coordinate) => dispatch(updateCoordinates(coordinate)),
  updateVisibility: (property, checked) => dispatch(updateVisibility(property, checked)),
});
const mapStateToProps = (state) => ({
  coordinates: state.App.coordinates,
  selectedCoordinate: state.App.selectedCoordinate,
  panels: state.App.panels
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(SettingsPanel));
