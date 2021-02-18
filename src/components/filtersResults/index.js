import React, { Component } from "react";
import { PropTypes } from "prop-types";
import { Link } from "react-router-dom";
import { withTranslation } from "react-i18next";
import { Card, List, Tag, Avatar, Space, Badge } from "antd";
import Wrapper from "./index.style";

const { Item } = List;
const { Meta } = Item;
class FilterResults extends Component {
  render() {
    const { t, dataRecords, loading } = this.props;
    return (
      <Wrapper>
        <Badge.Ribbon
          text={t("components.filters-results.badge", {
            count: dataRecords.length,
          })}
        >
          <Card size="small" title={t("components.filters-results.header")}>
            <List
              itemLayout="horizontal"
              dataSource={dataRecords}
              loading={loading}
              renderItem={(item, i) => (
                <Item>
                  <Meta
                    key={item.file}
                    avatar={<Avatar size={32}>{i + 1}</Avatar>}
                    title={
                      <Link to={`/?file=${item.file}`}>
                        <h2>{item.file}</h2>
                      </Link>
                    }
                    description={
                      <Space size={[4, 8]} wrap={true}>
                        {item.tags.map((d) => (
                          <Tag key={d}>{d}</Tag>
                        ))}
                      </Space>
                    }
                  />
                </Item>
              )}
            />
          </Card>
        </Badge.Ribbon>
      </Wrapper>
    );
  }
}

FilterResults.propTypes = {
  dataRecords: PropTypes.array,
  loading: PropTypes.bool,
};
FilterResults.defaultProps = {
  dataRecords: [],
  loading: false,
};
export default withTranslation("common")(FilterResults);
