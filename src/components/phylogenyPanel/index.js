import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space } from "antd";
import { withTranslation } from "react-i18next";
import { GrTree } from "react-icons/gr";
import ContainerDimensions from "react-container-dimensions";
import PhyloTree from "./phyloTree";
import Wrapper from "./index.style";

const margins = {
  padding: 0,
};

class PhylogenyPanel extends Component {
  render() {
    const { t, phylogeny, strainsList } = this.props;

    return (
      <Wrapper>
        <Card
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
          <ContainerDimensions>
            {({ width, height }) => {
              return <PhyloTree {...{ width: width - 2 * margins.padding, height: 600, newickString: phylogeny, strainsList: strainsList }} />;
            }}
          </ContainerDimensions>
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
  strainsList: state.Strains.strainsList
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(PhylogenyPanel));

