import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { connect } from "react-redux";
import { Row, Col, Card, Form, Input, Select, Button, Space } from "antd";
import DataSelectionWrapper from "./index.style";
import { withTranslation } from "react-i18next";
import { AiOutlineSearch } from "react-icons/ai";
import HomeHeader from "../../components/header";

const { Option } = Select;

class DataSelection extends Component {
  formRef = React.createRef();
  onFinish = (values) => {
    console.log(values);
  };
  onReset = () => {
    this.formRef.current && this.formRef.current.resetFields();
  };
  render() {
    const { t, datafiles, tags, loading } = this.props;
    return (
      <DataSelectionWrapper>
        <div className="ant-ds-header-container">
          <HomeHeader />
        </div>
        <div className="ant-ds-content-container">
          <Row gutter={0} className="ant-ds-filter-container">
            <Col className="gutter-row" span={24}>
              <Card
                size="small"
                title={t("containers.data-selection.section1.title")}
              >
                <Form
                  layout="inline"
                  ref={this.formRef}
                  initialValues={{}}
                  onFinish={this.onFinish}
                >
                  <Form.Item
                    name="categories"
                    label={t("containers.data-selection.section1.label1")}
                  >
                    <Select
                      mode="multiple"
                      className="categories-select"
                      allowClear={true}
                      loading={loading}
                      placeholder={t("containers.data-selection.section1.placeholder1")}
                      dropdownMatchSelectWidth={false}
                    >
                      {tags.map((d) => (
                        <Option key={d[0]}>{d[0]} - {d[1]}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="title"
                    label={t("containers.data-selection.section1.label2")}
                  >
                    <Input placeholder={t("containers.data-selection.section1.placeholder2")}/>
                  </Form.Item>
                  <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      <span role="img" className="anticon">
                        <AiOutlineSearch />
                      </span>
                      <span>
                        {t("containers.data-selection.section1.button1")}
                      </span>
                    </Button>
                    <Button
                      htmlType="button"
                      onClick={this.onReset}
                    >
                      {t("containers.data-selection.section1.button2")}
                    </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
          <Row gutter={0} className="ant-ds-content-container">
            <Col className="gutter-row" span={24}></Col>
          </Row>
        </div>
      </DataSelectionWrapper>
    );
  }
}

DataSelection.propTypes = {
  tags: PropTypes.object
};
DataSelection.defaultProps = {
  tags: [],
  loading: true,
};
const mapDispatchToProps = {};
const mapStateToProps = (state) => ({
  datafiles: state.App.datafiles,
  tags: state.App.tags,
  loading: state.App.loading
});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(DataSelection));
