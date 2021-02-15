import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { PageHeader } from "antd";
import Wrapper from "./index.style";

class HomeHeader extends Component {
  render() {
    return (
      <Wrapper>
        <PageHeader
          className="site-page-header"
          title="Title"
          subTitle="This is a subtitle"
        />
      </Wrapper>
    );
  }
}

export default HomeHeader;
