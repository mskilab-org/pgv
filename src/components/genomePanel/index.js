import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import ContainerDimensions from "react-container-dimensions";
import handleViewport from "react-in-viewport";
import { Card, Space, Button, Tooltip, message, Select } from "antd";
import * as d3 from "d3";
import { GiDna2 } from "react-icons/gi";
import { AiOutlineDownload } from "react-icons/ai";
import { downloadCanvasAsPng, transitionStyle, merge } from "../../helpers/utility";
import * as htmlToImage from "html-to-image";
import Wrapper from "./index.style";
import GenomePlot from "../genomePlot";
import Interval from "../genomePlot/interval";
import Connection from "../genomePlot/connection";
import appActions from "../../redux/app/actions";

const { updateDomains } = appActions;

const { Option } = Select;

const margins = {
  padding: 0,
  annotations: {minDistance: 10000000, padding: 1000, maxClusters: 6}
};

class GenomePanel extends Component {
  container = null;

  constructor(props) {
    super(props);
    const { chromoBins, genome } = this.props;
    let intervals = [];
    let intervalBins = {};
    genome.intervals.forEach((d, i) => {
      let interval = new Interval(d);
      interval.startPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.startPoint;
      interval.endPlace = chromoBins[`${interval.chromosome}`].startPlace + interval.endPoint;
      interval.color = d3.rgb(chromoBins[`${interval.chromosome}`].color).toString();
      interval.stroke = d3
        .rgb(chromoBins[`${interval.chromosome}`].color)
        .darker()
        .toString();
      intervalBins[d.iid] = interval;
      intervals.push(interval);
    });
    let frameConnections = genome.connections.map((d,i) => {
      let connection = new Connection(d);
      connection.pinpoint(intervalBins);
      //connection.yScale = this.yScale;
      connection.arc = d3.arc()
        .innerRadius(0)
        .outerRadius(margins.bar / 2)
        .startAngle(0)
        .endAngle((e, j) => e * Math.PI);
      return connection;
    });
    this.state = {
      activeAnnotation: null,
      intervals,
      connections: frameConnections
    }
  }

  onDownloadButtonClicked = () => {
    htmlToImage
      .toCanvas(this.container, { pixelRatio: 2 })
      .then((canvas) => {
        downloadCanvasAsPng(
          canvas,
          `${this.props.title.replace(/\s+/g, "_").toLowerCase()}.png`
        );
      })
      .catch((error) => {
        message.error(this.props.t("general.error", { error }));
      });
  };

  onAnnotationSelectChange = (value) => {
    this.setState({activeAnnotation: value}, () => {
      if (value !== undefined) {
        let clusters = this.changeAnnotationHandler(value);
        this.props.updateDomains(clusters);
      }
    });
  }

  changeAnnotationHandler(value) {
    let annotatedIntervals = this.state.intervals.filter(d => d.annotationArray.includes(value)).map((d,i) => { return {startPlace: d.startPlace, endPlace: d.endPlace} });
    let annotatedConnections = this.state.connections.filter(d => d.source && d.sink && d.annotationArray.includes(value)).map((d,i) => [{startPlace: (d.source.place - 1), endPlace: (d.source.place + 1)}, {startPlace: (d.sink.place - 1), endPlace: (d.sink.place + 1)}]).flat();
    let annotated = annotatedIntervals.concat(annotatedConnections);
    annotated = [...new Set(annotated)].sort((a,b) => d3.ascending(a.startPlace, b.startPlace));
    annotated = merge(annotated);

    let clusters = [{startPlace: annotated[0].startPlace, endPlace: annotated[0].endPlace}];
    for (let i = 0; i < annotated.length - 1; i++) {
      if (annotated[i + 1].startPlace - annotated[i].endPlace > margins.annotations.minDistance) {
        clusters.push({startPlace: annotated[i + 1].startPlace, endPlace: annotated[i + 1].endPlace});
      } else {
        clusters[clusters.length - 1].endPlace = annotated[i + 1].endPlace;
      }
    }
    while (clusters.length > margins.annotations.maxClusters) {
      clusters = clusters.sort((a,b) => a.startPlace - b.startPlace);
      let minDistance = Number.MAX_SAFE_INTEGER;
      let minIndex = 0;
      for (let i = 0; i < clusters.length - 1; i++) {
        if ((clusters[i + 1].startPlace - clusters[i].endPlace) < minDistance) {
          minDistance = clusters[i + 1].startPlace - clusters[i].endPlace;
          minIndex = i;
        }
      }
      clusters = clusters.slice(0,minIndex).concat([{startPlace: clusters[minIndex].startPlace, endPlace: clusters[minIndex+1].endPlace}]).concat(clusters.slice(minIndex + 2, clusters.length));
    }
    clusters = merge(clusters.map((d,i) => { return {
      startPlace: d3.max([(d.startPlace - 0.66 * (d.endPlace - d.startPlace)),1]),
      endPlace: d3.min([(d.endPlace + 0.66 * (d.endPlace - d.startPlace)), this.props.genomeLength])
    }})).sort((a,b) => d3.ascending(a.startPlace, b.startPlace));
    
    return clusters.map((d,i) => [Math.floor(d.startPlace), Math.floor(d.endPlace)]);
  }

  render() {
    const {
      t,
      genome,
      title,
      inViewport,
      renderOutsideViewPort
    } = this.props;
    let { activeAnnotation } = this.state;
    if (Object.keys(genome).length < 1) return null;
    let intervalAnnotations = genome.intervals.map(d => new Interval(d).annotationArray).flat();
    let annotationValues = [...new Set(intervalAnnotations)].sort((a,b) => d3.ascending(a,b));
    return (
      <Wrapper>
        <Card
          style={transitionStyle(inViewport || renderOutsideViewPort)}
          size="small"
          title={
            <Space>
              <span role="img" className="anticon anticon-dashboard">
                <GiDna2 />
              </span>
              <span className="ant-pro-menu-item-title">{title}</span>
              <span>
                <b>{d3.format(",")(genome.intervals.length)}</b>{" "}
                {t("components.genome-panel.interval", {
                  count: genome.intervals.length,
                })}
              </span>
              <span>
                <Select
                  allowClear
                  onChange={(value) => this.onAnnotationSelectChange(value)}
                  style={{ width: 200 }}
                  placeholder={t("components.genome-panel.select-annotation-placeholder")}
                  optionFilterProp="children"
                >
                  {annotationValues.map(d => <Option value={d}>{d}</Option>)}
                </Select>
              </span>
            </Space>
          }
          extra={
            <Space>
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
          {(
            <div className="ant-wrapper" ref={(elem) => (this.container = elem)}>
              <ContainerDimensions>
                {({ width, height }) => {
                  return (
                    (inViewport || renderOutsideViewPort) && <GenomePlot
                      {...{
                        width: width - 2 * margins.padding,
                        height,
                        genome,
                        annotation: activeAnnotation
                      }}
                    />
                  );
                }}
              </ContainerDimensions>
            </div>
          )}
        </Card>
      </Wrapper>
    );
  }
}
GenomePanel.propTypes = {};
GenomePanel.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({
  updateDomains: (domains) => dispatch(updateDomains(domains))
});
const mapStateToProps = (state) => ({
  renderOutsideViewPort: state.App.renderOutsideViewPort,
  genomeLength: state.App.genomeLength,
  domains: state.App.domains
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(handleViewport(GenomePanel, { rootMargin: '-1.0px' })));

