import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space, Empty } from "antd";
import { withTranslation } from "react-i18next";
import { GrTree } from "react-icons/gr";
import ContainerDimensions from "react-container-dimensions";
import PhyloTree from "./phyloTree";
import Wrapper from "./index.style";

const margins = {
  padding: 0,
  minHeight: 600
};

class PhylogenyPanel extends Component {
  render() {
    const { t, phylogeny, strainsList, geography, loading } = this.props;

    return (
      <Wrapper>
        <Card
          loading={loading}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GrTree />
              </span>
              <span className="ant-pro-menu-item-title">
                {t("components.phylogeny-panel.header")}
              </span>
            </Space>
          }
        >
          {!phylogeny && <Empty description={t("components.phylogeny-panel.no-data-message")}/>}
          {phylogeny && <ContainerDimensions>
            {({ width, height }) => {
              return <PhyloTree {...{ width: (width - 2 * margins.padding), height: margins.minHeight, newickString: phylogeny, strainsList: strainsList, geography: geography }} />;
            }}
          </ContainerDimensions>}
        </Card>
      </Wrapper>
    );
  }
}
PhylogenyPanel.propTypes = {};
PhylogenyPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
});
const mapStateToProps = (state) => ({
  phylogeny: state.Strains.phylogeny,
  strainsList: state.Strains.strainsList,
  geography: state.Strains.geography,
  loading: state.Strains.loading
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(PhylogenyPanel));

