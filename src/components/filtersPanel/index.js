import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Card, Form, Select, Space, Button, Input } from "antd";
import { withTranslation } from "react-i18next";
import { AiOutlineSearch } from "react-icons/ai";
import Wrapper from "./index.style";

const { Option } = Select;
const { Item } = Form;

class FiltersPanel extends Component {
  formRef = React.createRef();
  onFinish = (values) => {
    this.props.onSearch(values)
  };
  onReset = () => {
    this.formRef.current && this.formRef.current.resetFields();
  };
  render() {
    const { t, tags, loading } = this.props;
    return (
      <Wrapper>
        <Card
          size="small"
          title={t("components.filters-panel.header")}
        >
          <Form
            layout="inline"
            ref={this.formRef}
            initialValues={{}}
            onFinish={this.onFinish}
          >
            <Item
              name="tags"
              label={t("components.filters-panel.tags-section.label")}
            >
              <Select
                mode="multiple"
                className="tags-select"
                allowClear={true}
                loading={loading}
                showArrow={true}
                optionLabelProp="value"
                maxTagCount={3}
                placeholder={t(
                  "components.filters-panel.tags-section.placeholder"
                )}
                dropdownMatchSelectWidth={false}
              >
                {tags.map((d) => (
                  <Option key={d[0]}>
                    {d[0]} (
                    {t("components.filters-panel.tags-section.sample", {
                      count: +d[1],
                    })})
                  </Option>
                ))}
              </Select>
            </Item>
            <Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  <span role="img" className="anticon">
                    <AiOutlineSearch />
                  </span>
                  <span>{t("components.filters-panel.buttons-section.submit")}</span>
                </Button>
                <Button htmlType="button" onClick={this.onReset}>
                  {t("components.filters-panel.buttons-section.reset")}
                </Button>
              </Space>
            </Item>
          </Form>
        </Card>
      </Wrapper>
    );
  }
}
FiltersPanel.propTypes = {
  tags: PropTypes.array,
  onSearch: PropTypes.func
};
FiltersPanel.defaultProps = {
  tags: [],
  loading: true,
};
export default withTranslation("common")(FiltersPanel);
