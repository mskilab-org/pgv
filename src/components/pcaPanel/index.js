import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { withTranslation } from "react-i18next";
import { AiOutlineDotChart } from "react-icons/ai";
import Wrapper from "./index.style";
import appActions from "../../redux/strains/actions";
import Plot from "./plot";

const margins = {
  padding: 0,
};
const { getPcaData } = appActions;

class PcaPanel extends Component {

  componentDidMount() {
    let params = new URL(decodeURI(document.location)).searchParams;
    let file = params.get("file");
    file && this.props.getPcaData(file);
  }

  render() {
    const { t, loading, pcaData, geographyHash, strainsList } = this.props;
    if (!pcaData) {
      return null;
    }
    var strainsHash = new Map(strainsList.map(d => [+d.sid, d]));
    let points = [];
    pcaData.forEach((d,i) => {
      points.push({...d, record: strainsHash.get(+d.sid), location: geographyHash[+strainsHash.get(+d.sid).gid]});
    });

    return (
      <Wrapper>
        <Card
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <AiOutlineDotChart />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.pca-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")(pcaData.length)}</b> {t("components.pca-panel.datapoint", {count: pcaData.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <Plot
                    {...{ width: width - 2 * margins.padding, height: height, points: points, title: t("components.pca-panel.title")}}
                  />
                );
              }}
            </ContainerDimensions>
          </div>
        </Card>
      </Wrapper>
    );
  }
}
PcaPanel.propTypes = {};
PcaPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  getPcaData: (file) => dispatch(getPcaData(file)),
});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  pcaData: state.Strains.pcaData,
  geographyHash: state.App.geographyHash,
  strainsList: state.Strains.strainsList
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(PcaPanel));
