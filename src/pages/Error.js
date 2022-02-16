import React, { Component } from "react";
import { withTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Result } from "antd";

class Error extends Component {
  render() {
    const { t } = this.props;
    return (
      <main className="error-page">
        <section className="error-area padding-top-140px">
          <Result
            status="404"
            title="404"
            subTitle={t("general.page-not-found")}
            extra={
              <Link type="primary" to="/">
                {t("general.back-to-home")}
              </Link>
            }
          />
        </section>
      </main>
    );
  }
}

export default withTranslation("common")(Error);
