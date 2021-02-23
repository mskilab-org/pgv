import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Row, Col, Radio } from "antd";
import { withTranslation } from "react-i18next";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { Button, Group } = Radio;
const { updateCoordinates } = appActions;

class SettingsPanel extends Component {

  onChange = e => {
    console.log('radio checked', e.target.value);
    this.props.updateCoordinates(e.target.value)
  };

  render() {
    const { t, coordinates, selectedCoordinate } = this.props;
    return (
      <Wrapper>
        <Row gutter={24}>
            <Col className="gutter-row" span={24}>
              <label>{t("components.settings-panel.coordinates.label")}</label>
            </Col>
            <Col className="gutter-row" span={24}>
            <Group onChange={this.onChange} defaultValue={selectedCoordinate || coordinates.default}>
                {Object.keys(coordinates.sets).map(d => <Button key={d} value={d}>{d}</Button>)}
              </Group>
            </Col>
          </Row>
        <Row>
        
        </Row>
      </Wrapper>
    );
  }
}
SettingsPanel.propTypes = {};
SettingsPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateCoordinates: (coordinate) => dispatch(updateCoordinates(coordinate)),
});
const mapStateToProps = (state) => ({
  coordinates: state.App.coordinates,
  selectedCoordinate: state.App.selectedCoordinate,
});

export default connect(mapStateToProps, mapDispatchToProps)(withTranslation("common")(SettingsPanel));
