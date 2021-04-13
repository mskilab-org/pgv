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
import appActions from "../../redux/app/actions";

const { updateDomain } = appActions;

const margins = {
  padding: 0,
};

class GenomePanel extends Component {
  render() {
    const { t, genome, domain, defaultDomain, updateDomain, chromoBins } = this.props;
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
          extra={<p><b>{d3.format(",")(genome.intervals.length)}</b> {t("components.genome-panel.interval", {count: genome.intervals.length})}</p>}
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
                      updateDomain: updateDomain,
                      defaultDomain: defaultDomain,
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
const mapDispatchToProps = (dispatch) => ({
  updateDomain: (from, to) => dispatch(updateDomain(from,to))
});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  defaultDomain: state.App.defaultDomain,
  genome: state.Genome.genome,
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenomePanel));
