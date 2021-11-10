import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Card, Space, Empty } from "antd";
import ContainerDimensions from "react-container-dimensions";
import { withTranslation } from "react-i18next";
import { GiAnatomy } from "react-icons/gi";
import Body from "./body";
import Wrapper from "./index.style";
import appActions from "../../redux/app/actions";

const { selectPhylogenyNodes } = appActions;

class AnatomyPanel extends Component {
  render() {
    const { t, title, height, anatomy, figure, nodes, selectPhylogenyNodes, highlightedNodes } = this.props;

    return (
      <Wrapper empty={anatomy.length < 1} minHeight={height}>
        <Card
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiAnatomy />
              </span>
              <span className="ant-pro-menu-item-title">
                {title || t("components.anatomy-panel.header")}
              </span>
            </Space>
          }
        >
          <div className="ant-wrapper">
            {anatomy.length < 1 && (
              <Empty
                description={t("components.anatomy-panel.no-data-message")}
              />
            )}
            {anatomy.length > 0 && (
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    <Body
                      {...{ width: width, height: height, figure, locations: anatomy, nodes, highlightedNodes, onNodeClick: selectPhylogenyNodes }}
                    />
                  );
                }}
              </ContainerDimensions>
            )}
          </div>
        </Card>
      </Wrapper>
    );
  }
}
AnatomyPanel.propTypes = {
  anatomy: PropTypes.array,
};
AnatomyPanel.defaultProps = {
  anatomy: [],
};
const mapDispatchToProps = (dispatch) => ({
  selectPhylogenyNodes: (nodes) =>
    dispatch(selectPhylogenyNodes(nodes)),
});
const mapStateToProps = (state) => ({
  loading: state.App.loading,
  nodes: state.App.nodes,
  highlightedNodes: state.App.highlightedNodes
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(AnatomyPanel));
