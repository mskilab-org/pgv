const actions = {
  GET_GEOGRAPHY: "GET_GEOGRAPHY",
  GEOGRAPHY_RECEIVED: "GEOGRAPHY_RECEIVED",
  DOMAINS_UPDATED: "DOMAINS_UPDATED",
  LAUNCH_APP: "LAUNCH_APP",
  LAUNCH_APP_SUCCESS: "LAUNCH_APP_SUCCESS",
  LAUNCH_APP_FAILED: "LAUNCH_APP_FAILED",
  launchApp: () => ({
    type: actions.LAUNCH_APP,
  }),
  getGeography: (file) => ({
    type: actions.GET_GEOGRAPHY,
    file: file
  }),
  updateDomains: (domains) => ({
    type: actions.DOMAINS_UPDATED,
    domains
  }),
};

export default actions;
