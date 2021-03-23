import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { GiDna2 } from "react-icons/gi";
import Wrapper from "./index.style";
import GenomePlot from "../genomePlot";

const margins = {
  padding: 0,
};

class GenomePanel extends Component {
  render() {
    const { t, genome, domain, chromoBins } = this.props;
    if (Object.keys(genome).length < 1) return null;
    return (
      <Wrapper>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiDna2 />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.genome-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{(genome.intervals.length)}</b> {t("components.genome-panel.interval", {count: genome.intervals.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <GenomePlot
                    {...{
                      width: width - 2 * margins.padding,
                      height: height,
                      genome: genome,
                      xDomain: domain,
                      chromoBins: chromoBins,
                    }}
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
GenomePanel.propTypes = {
};
GenomePanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  genome: state.Genome.genome,
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenomePanel));
