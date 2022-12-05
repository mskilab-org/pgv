import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import {
  Card,
  Space,
  Tooltip,
  Button,
  message,
  Row,
  Col,
  Select,
  Typography,
} from "antd";
import * as d3 from "d3";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng, merge, cluster } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import { CgArrowsBreakeH } from "react-icons/cg";
import Wrapper from "./index.style";
import GenesPlot from "../genesPlot";
import appActions from "../../redux/app/actions";

const { updateDomains } = appActions;

const { Text } = Typography;

const margins = {
  padding: 0,
  gap: 0,
};

class GenesPanel extends Component {
  container = null;
  genesStructure = null;

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props
            .t("components.genes-panel.header")
            .replace(/\s+/g, "_")
            .toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  handleGenesLocatorChange = (values) => {
    const { genomeLength, chromoBins, genes } = this.props;
    let selectedGenes = values.map((d, i) => genes.get(d).toJSON());
    let newDomains = selectedGenes.map((d, i) => [
      d3.max([Math.floor(0.99999 * d.startPlace), 1]),
      d3.min([Math.floor(1.00001 * d.endPlace), genomeLength]),
    ]);
    if (values.length < 1) {
      let firstChromosome = Object.values(chromoBins)[0];
      newDomains = [[firstChromosome.startPlace, firstChromosome.endPlace]];
      this.props.updateDomains(newDomains);
    } else {
      let merged = merge(
        newDomains
          .map((d) => {
            return { startPlace: d[0], endPlace: d[1] };
          })
          .sort((a, b) => d3.ascending(a.startPlace, b.startPlace))
      );
      this.props.updateDomains(cluster(merged, genomeLength));
    }
  };

  render() {
    const { t, genes, domains } = this.props;
    if (!genes) return null;
    let geneTypesIndexes = genes
      .getChild("type")
      .toArray()
      .map((d, i) => (d === "gene" ? i : undefined))
      .filter((x) => x);
    let geneTitlesList = genes.getChild("title").toArray();
    let optionsList = geneTypesIndexes
      .map((d, i) => {
        return {
          label: geneTitlesList[d],
          value: d,
        };
      })
      .sort((a, b) =>
        d3.ascending(a.label.toLowerCase(), b.label.toLowerCase())
      );
    return (
      <Wrapper>
        {
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
                <span>
                  <b>{d3.format(",")(genes.numRows)}</b>{" "}
                  {t("components.genes-panel.gene", { count: genes.numRows })}
                </span>
              </Space>
            }
            extra={
              <Space>
                <Text type="secondary">{t("components.zoom-help")}</Text>
                <Select
                  allowClear
                  showSearch
                  mode="multiple"
                  style={{ width: 300 }}
                  placeholder={t("components.genes-panel.locator")}
                  onChange={this.handleGenesLocatorChange}
                  options={optionsList}
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.label.toLowerCase() ?? "").includes(
                      input.toLowerCase()
                    )
                  }
                  filterSort={(optionA, optionB) =>
                    (optionA?.label ?? "")
                      .toLowerCase()
                      .localeCompare((optionB?.label ?? "").toLowerCase())
                  }
                />
                <Tooltip title={t("components.download-as-png-tooltip")}>
                  <Button
                    type="default"
                    shape="circle"
                    icon={<AiOutlineDownload />}
                    size="small"
                    onClick={() => this.onDownloadButtonClicked()}
                  />
                </Tooltip>
              </Space>
            }
          >
            {
              <div
                className="ant-wrapper"
                ref={(elem) => (this.container = elem)}
              >
                <ContainerDimensions>
                  {({ width, height }) => {
                    return (
                      <Row style={{ width }} gutter={[margins.gap, 0]}>
                        <Col flex={1}>
                          <GenesPlot
                            {...{
                              width,
                              height,
                              domains,
                              genes,
                            }}
                          />
                        </Col>
                      </Row>
                    );
                  }}
                </ContainerDimensions>
              </div>
            }
          </Card>
        }
      </Wrapper>
    );
  }
}
GenesPanel.propTypes = {};
GenesPanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains)),
});
const mapStateToProps = (state) => ({
  chromoBins: state.App.chromoBins,
  domains: state.App.domains,
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  genomeLength: state.App.genomeLength,
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(
  withTranslation("common")(
    handleViewport(GenesPanel, { rootMargin: "-1.0px" })
  )
);
