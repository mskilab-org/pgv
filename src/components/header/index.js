import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { PageHeader, Space, Tag } from "antd";
import Wrapper from "./index.style";

class Header extends Component {
  render() {
    const { title, subTitle, tags } = this.props;
    return (
      <Wrapper>
        <PageHeader className="site-page-header" {...{ title, subTitle }}>
          <div className="site-page-content">
            <Space wrap={true}>
              {tags.map((d) => (
                <Tag>{d}</Tag>
              ))}
            </Space>
          </div>
        </PageHeader>
      </Wrapper>
    );
  }
}
Header.propTypes = {
  title: PropTypes.string,
  subTitle: PropTypes.string,
  tags: PropTypes.array,
};
Header.defaultProps = {
  title: "The Title",
  subTitle: "The subtitle",
  tags: [],
};
export default Header;
