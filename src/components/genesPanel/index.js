import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import { Card, Space } from "antd";
import * as d3 from "d3";
import { CgArrowsBreakeH } from "react-icons/cg";
import Wrapper from "./index.style";
import GenesPlot from "../genesPlot";

const margins = {
  padding: 0,
};

class GenesPanel extends Component {
  render() {
    const { t, genes, domain, chromoBins } = this.props;
    const geneTypes = genes.filter((d,i) => d.type === 'gene');
    if (genes.length < 1) return null;
    return (
      <Wrapper>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <CgArrowsBreakeH />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.genes-panel.header")}
              </span>
            </Space>
          }
          extra={<p><b>{d3.format(",")((geneTypes.length))}</b> {t("components.genes-panel.gene", {count: geneTypes.length})}</p>}
        >
          <div className="ant-wrapper">
            <ContainerDimensions>
              {({ width, height }) => {
                return (
                  <GenesPlot
                    {...{
                      width: width - 2 * margins.padding,
                      height: height,
                      genes: geneTypes,
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
GenesPanel.propTypes = {
};
GenesPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({
  loading: state.Strains.loading,
  domain: state.App.domain,
  genes: state.App.genes,
  chromoBins: state.App.chromoBins,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(GenesPanel));
